"""FastAPI application factory for embedding the execution engine."""

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .agents import AgentRegistry
from .execution import WorkflowExecutor
from .tools import ToolRegistry
from .workflows import WorkflowRegistry


class ExecuteRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20_000)


def create_app(agents: AgentRegistry, workflows: WorkflowRegistry,
               tools: ToolRegistry, executor: WorkflowExecutor) -> FastAPI:
    app = FastAPI(title="AI Workflow Engine", version="0.1.0")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/agents")
    async def list_agents() -> list[dict[str, Any]]:
        return [{"name": agent.name, "description": agent.description,
                 "tools": list(agent.tool_names)} for agent in agents.list()]

    @app.get("/workflows")
    async def list_workflows() -> list[dict[str, Any]]:
        return [{"name": workflow.name, "description": workflow.description,
                 "entry_agent": workflow.entry_agent} for workflow in workflows.list()]

    @app.get("/tools")
    async def list_tools() -> list[str]:
        return tools.names()

    @app.post("/workflows/{workflow_name}/execute")
    async def execute(workflow_name: str, request: ExecuteRequest) -> dict[str, Any]:
        try:
            return await executor.execute(workflow_name, request.prompt)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Workflow execution failed") from exc

    return app
