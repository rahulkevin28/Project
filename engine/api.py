"""FastAPI application factory for embedding the execution engine."""

import asyncio
import json
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, HTTPException, Security, status
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from .agents import GROUNDING_RULES, AgentDefinition, AgentRegistry
from .execution import RunListener, WorkflowExecutor
from .runtime import HTTP_STATUS_BY_CODE
from .tools import ToolRegistry
from .workflows import WorkflowDefinition, WorkflowRegistry

CONSOLE_DIR = Path(__file__).parent / "console"

_bearer = HTTPBearer(
    auto_error=False,
    description="The value of ENGINE_API_TOKEN, sent as `Authorization: Bearer <token>`.",
)


class _ConsoleFiles(StaticFiles):
    """Serve the console and make browsers revalidate it, so updates show on reload."""

    async def get_response(self, path: str, scope: Any) -> Any:
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


def _message(exc: Exception) -> str:
    """Return an exception's message without the quotes ``str(KeyError)`` adds."""
    return str(exc.args[0]) if exc.args else str(exc)


class ExecuteRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20_000)


class AgentRegistration(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    description: str = Field(min_length=1, max_length=500)
    system_prompt: str = Field(min_length=1, max_length=12_000)
    tool_names: list[str] = Field(default_factory=list, max_length=20)
    max_tool_rounds: int = Field(default=5, ge=0, le=10)


class HandoffEdge(BaseModel):
    source: str
    target: str


class WorkflowRegistration(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    description: str = Field(min_length=1, max_length=500)
    entry_agent: str
    max_handoffs: int = Field(default=8, ge=0, le=32)
    edges: list[HandoffEdge] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_edges(self):
        keys = [(edge.source, edge.target) for edge in self.edges]
        if len(keys) != len(set(keys)):
            raise ValueError("Workflow edges must be unique")
        if any(edge.source == edge.target for edge in self.edges):
            raise ValueError("A workflow edge cannot route an agent to itself")
        adjacency: dict[str, set[str]] = {}
        for edge in self.edges:
            adjacency.setdefault(edge.source, set()).add(edge.target)
            adjacency.setdefault(edge.target, set())
        reachable = {self.entry_agent}
        pending = [self.entry_agent]
        while pending:
            for target in adjacency.get(pending.pop(), set()) - reachable:
                reachable.add(target)
                pending.append(target)
        if set(adjacency) - reachable:
            raise ValueError("Every workflow node must be reachable from entry_agent")
        return self

    def agent_names(self) -> set[str]:
        return {self.entry_agent, *(edge.source for edge in self.edges),
                *(edge.target for edge in self.edges)}


class RunRequest(BaseModel):
    """A self-contained run: the caller supplies the workflow and agent definitions."""

    prompt: str = Field(min_length=1, max_length=20_000)
    workflow: WorkflowRegistration
    agents: list[AgentRegistration] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_agents(self):
        names = [agent.name for agent in self.agents]
        if len(names) != len(set(names)):
            raise ValueError("Agent names must be unique")
        missing = sorted(self.workflow.agent_names() - set(names))
        if missing:
            raise ValueError(f"The workflow uses agents that were not supplied: {', '.join(missing)}")
        return self


def _agent_from(request: AgentRegistration) -> AgentDefinition:
    return AgentDefinition(
        name=request.name, description=request.description,
        system_prompt=request.system_prompt, tool_names=tuple(request.tool_names),
        max_tool_rounds=request.max_tool_rounds,
    )


def _workflow_from(request: WorkflowRegistration) -> WorkflowDefinition:
    return WorkflowDefinition(
        name=request.name, description=request.description,
        entry_agent=request.entry_agent, max_handoffs=request.max_handoffs,
        edges=tuple((edge.source, edge.target) for edge in request.edges),
    )


def _workflow_summary(workflow: WorkflowDefinition) -> dict[str, Any]:
    return {"name": workflow.name, "description": workflow.description,
            "entry_agent": workflow.entry_agent, "max_handoffs": workflow.max_handoffs,
            "edges": [{"source": source, "target": target} for source, target in workflow.edges]}


def _run_response(record: dict[str, Any]) -> dict[str, Any] | JSONResponse:
    """Return completed runs as-is; failed runs keep the record with a matching HTTP status."""
    error = record.get("error")
    if not error:
        return record
    return JSONResponse(status_code=HTTP_STATUS_BY_CODE.get(error["code"], 500),
                        content={**record, "detail": error["message"]})


# A comment line keeps the connection active during long model calls, so proxies and
# browsers don't treat it as idle.
_KEEP_ALIVE_SECONDS = 15.0


def _event_stream(start: Callable[[RunListener], Awaitable[dict[str, Any]]]) -> StreamingResponse:
    """Run ``start`` and stream its progress events as server-sent events.

    If the client disconnects, the run is cancelled so it stops using the model.
    """
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def produce() -> None:
        try:
            await start(queue.put)
        finally:
            await queue.put(None)

    async def frames() -> AsyncIterator[str]:
        task = asyncio.create_task(produce())
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=_KEEP_ALIVE_SECONDS)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if event is None:
                    break
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
            await task
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(frames(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def create_app(agents: AgentRegistry, workflows: WorkflowRegistry,
               tools: ToolRegistry, executor: WorkflowExecutor, *,
               model_info: dict[str, str] | None = None,
               api_token: str | None = None) -> FastAPI:
    """Build the API.

    ``model_info`` may name the provider and model; never pass secrets. When ``api_token``
    is set, every route except ``/health``, the console page, and the API docs requires
    ``Authorization: Bearer <api_token>``.
    """
    app = FastAPI(
        title="AI Workflow Engine", version="0.1.0",
        description="Open the [workflow console](/console/) to run workflows and manage "
                    "agents in the browser.",
    )

    async def require_token(
        credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_bearer)],
    ) -> None:
        supplied = credentials.credentials if credentials else ""
        if not secrets.compare_digest(supplied.encode(), (api_token or "").encode()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="A valid engine token is required.",
                                headers={"WWW-Authenticate": "Bearer"})

    router = APIRouter(dependencies=[Security(require_token)] if api_token else [])

    @app.get("/", include_in_schema=False)
    async def home() -> RedirectResponse:
        return RedirectResponse(url="/console/", status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/info")
    async def info() -> dict[str, Any]:
        details = model_info or {}
        return {"name": app.title, "version": app.version,
                "provider": details.get("provider"), "model": details.get("model"),
                "auth_required": bool(api_token), "grounding_rules": GROUNDING_RULES}

    @router.get("/agents")
    async def list_agents() -> list[dict[str, Any]]:
        return [{"name": agent.name, "description": agent.description,
                 "tools": list(agent.tool_names)} for agent in agents.list()]

    @router.get("/agents/{agent_name}")
    async def get_agent(agent_name: str) -> dict[str, Any]:
        try:
            agent = agents.get(agent_name)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=_message(exc)) from exc
        return {"name": agent.name, "description": agent.description,
                "tools": list(agent.tool_names), "system_prompt": agent.system_prompt,
                "max_tool_rounds": agent.max_tool_rounds}

    @router.post("/agents", status_code=status.HTTP_201_CREATED)
    async def create_agent(request: AgentRegistration) -> dict[str, Any]:
        try:
            tools.resolve(request.tool_names)
            agent = _agent_from(request)
            agents.register(agent)
        except KeyError as exc:
            raise HTTPException(status_code=422, detail=_message(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=_message(exc)) from exc
        return {"name": agent.name, "description": agent.description,
                "tools": list(agent.tool_names)}

    @router.put("/agents/{agent_name}")
    async def update_agent(agent_name: str, request: AgentRegistration) -> dict[str, Any]:
        if request.name != agent_name:
            raise HTTPException(status_code=422, detail="Agent name cannot change through this route")
        try:
            tools.resolve(request.tool_names)
            agent = _agent_from(request)
            agents.replace(agent)
        except KeyError as exc:
            raise HTTPException(status_code=404 if "Unknown agent" in str(exc) else 422,
                                detail=_message(exc)) from exc
        return {"name": agent.name, "description": agent.description,
                "tools": list(agent.tool_names)}

    @router.delete("/agents/{agent_name}")
    async def delete_agent(agent_name: str) -> dict[str, str]:
        linked_workflows = [workflow.name for workflow in workflows.list()
                            if workflow.entry_agent == agent_name or any(
                                agent_name in edge for edge in workflow.edges
                            )]
        if linked_workflows:
            raise HTTPException(
                status_code=409,
                detail=f"Agent is used by workflows: {', '.join(linked_workflows)}",
            )
        try:
            agents.remove(agent_name)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=_message(exc)) from exc
        return {"status": "deleted", "name": agent_name}

    @router.get("/workflows")
    async def list_workflows() -> list[dict[str, Any]]:
        return [_workflow_summary(workflow) for workflow in workflows.list()]

    def _check_agents_exist(request: WorkflowRegistration) -> None:
        for name in sorted(request.agent_names()):
            agents.get(name)

    @router.post("/workflows", status_code=status.HTTP_201_CREATED)
    async def create_workflow(request: WorkflowRegistration) -> dict[str, Any]:
        try:
            _check_agents_exist(request)
            workflow = _workflow_from(request)
            workflows.register(workflow)
        except KeyError as exc:
            raise HTTPException(status_code=422, detail=_message(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=_message(exc)) from exc
        return _workflow_summary(workflow)

    @router.put("/workflows/{workflow_name}")
    async def update_workflow(workflow_name: str,
                              request: WorkflowRegistration) -> dict[str, Any]:
        if request.name != workflow_name:
            raise HTTPException(status_code=422, detail="Workflow name cannot change through this route")
        try:
            _check_agents_exist(request)
            workflow = _workflow_from(request)
            workflows.replace(workflow)
        except KeyError as exc:
            raise HTTPException(status_code=404 if "Unknown workflow" in str(exc) else 422,
                                detail=_message(exc)) from exc
        return _workflow_summary(workflow)

    @router.delete("/workflows/{workflow_name}")
    async def delete_workflow(workflow_name: str) -> dict[str, str]:
        try:
            workflows.remove(workflow_name)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=_message(exc)) from exc
        return {"status": "deleted", "name": workflow_name}

    @router.get("/tools")
    async def list_tools() -> list[str]:
        return tools.names()

    @router.post("/workflows/{workflow_name}/execute", response_model=None)
    async def execute(workflow_name: str,
                      request: ExecuteRequest) -> dict[str, Any] | JSONResponse:
        """Run a registered workflow. Failed runs return their run record with an error code."""
        try:
            record = await executor.execute(workflow_name, request.prompt)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=_message(exc)) from exc
        return _run_response(record)

    @router.post("/workflows/{workflow_name}/execute/stream", response_class=StreamingResponse)
    async def execute_stream(workflow_name: str, request: ExecuteRequest) -> StreamingResponse:
        """Run a registered workflow and stream its progress as server-sent events.

        Events: ``run_started``, ``step_started``, ``step_finished``, and ``run_finished``
        (which carries the full run record, including for failed runs).
        """
        try:
            workflow = workflows.get(workflow_name)
            executor.validate(workflow)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=_message(exc)) from exc
        return _event_stream(
            lambda listener: executor.run(workflow, request.prompt, listener=listener))

    def _registry_for(request: RunRequest) -> AgentRegistry:
        registry = AgentRegistry()
        try:
            for item in request.agents:
                tools.resolve(item.tool_names)
                registry.register(_agent_from(item))
        except KeyError as exc:
            raise HTTPException(status_code=422, detail=_message(exc)) from exc
        return registry

    @router.post("/runs", response_model=None)
    async def run_definitions(request: RunRequest) -> dict[str, Any] | JSONResponse:
        """Run a workflow from definitions in the request, without registering anything.

        This lets the platform backend keep agents and workflows in its own database and
        send them with each run.
        """
        registry = _registry_for(request)
        record = await executor.run(_workflow_from(request.workflow), request.prompt, registry)
        return _run_response(record)

    @router.post("/runs/stream", response_class=StreamingResponse)
    async def run_definitions_stream(request: RunRequest) -> StreamingResponse:
        """Like ``POST /runs``, but streams progress as server-sent events."""
        registry = _registry_for(request)
        workflow = _workflow_from(request.workflow)
        return _event_stream(
            lambda listener: executor.run(workflow, request.prompt, registry, listener=listener))

    app.include_router(router)
    app.mount("/console", _ConsoleFiles(directory=CONSOLE_DIR, html=True), name="console")
    return app
