"""LangGraph-backed execution with explicit inter-agent handoff decisions."""

import asyncio
import logging
import time
from collections.abc import Mapping
from typing import Annotated, Any, TypedDict
from uuid import uuid4

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, START, StateGraph

from .agents import AgentRegistry
from .runtime import (
    EngineError,
    ExecutionPolicy,
    ModelPrice,
    StepTrace,
    classify_error,
    ms_since,
    utc_now,
)
from .tools import ToolRegistry
from .workflows import WorkflowDefinition, WorkflowRegistry

logger = logging.getLogger(__name__)

STATUS_COMPLETED = "completed"
STATUS_HANDOFF_LIMIT_REACHED = "handoff_limit_reached"
STATUS_FAILED = "failed"


def _append(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return left + right


class ExecutionState(TypedDict, total=False):
    prompt: str
    current_agent: str
    result: str
    handoff_to: str | None
    handoffs: int
    max_handoffs: int
    history: Annotated[list[dict[str, Any]], _append]


def build_agent_input(prompt: str, history: list[dict[str, Any]]) -> str:
    """Give an agent the original request plus every handoff note made so far.

    Receiving agents always see the user's own words, so supplied facts such as policy
    wording are never replaced by another agent's paraphrase.
    """
    handoffs = [entry for entry in history if entry.get("handoff_to")]
    if not handoffs:
        return prompt
    notes = "\n\n".join(
        f"Handoff notes from {entry['agent']} to {entry['handoff_to']}:\n"
        f"{entry.get('handoff_context') or 'No notes were provided.'}"
        for entry in handoffs
    )
    return (
        "Original user request (the source of truth; do not add facts it does not state):\n"
        f"{prompt}\n\n{notes}"
    )


def _model_name(model: Any) -> str | None:
    for attr in ("model_name", "model"):
        value = getattr(model, attr, None)
        if isinstance(value, str) and value:
            return value
    return None


class WorkflowExecutor:
    def __init__(self, agents: AgentRegistry, workflows: WorkflowRegistry,
                 tools: ToolRegistry, model: BaseChatModel, *,
                 policy: ExecutionPolicy | None = None, model_name: str | None = None,
                 prices: Mapping[str, ModelPrice] | None = None) -> None:
        self.agents = agents
        self.workflows = workflows
        self.tools = tools
        self.model = model
        self.policy = policy or ExecutionPolicy()
        self.model_name = model_name or _model_name(model)
        self.prices = dict(prices or {})

    def _graph(self, workflow: WorkflowDefinition, agents: AgentRegistry,
               steps: list[StepTrace]):
        builder = StateGraph(ExecutionState)
        agent_names = {workflow.entry_agent}
        for source, target in workflow.edges:
            agent_names.update((source, target))
        agent_definitions = [agents.get(name) for name in sorted(agent_names)]
        for definition in agent_definitions:
            async def run_agent(state: ExecutionState, agent_name: str = definition.name):
                trace = StepTrace(agent=agent_name)
                steps.append(trace)
                try:
                    response = await agents.invoke(
                        agent_name, build_agent_input(state["prompt"], state.get("history", [])),
                        self.model, self.tools, workflow.targets_for(agent_name),
                        policy=self.policy, trace=trace,
                    )
                except Exception as exc:
                    error = classify_error(exc, agent_name)
                    trace.finish(STATUS_FAILED, error.as_dict())
                    if error is exc:
                        raise
                    raise error from exc
                trace.result = response.content
                trace.handoff_to = response.handoff_to
                trace.handoff_context = response.handoff_context
                trace.finish(STATUS_COMPLETED)
                return {
                    "result": response.content,
                    "handoff_to": response.handoff_to,
                    "current_agent": agent_name,
                    "history": [{"agent": agent_name, "result": response.content,
                                 "handoff_to": response.handoff_to,
                                 "handoff_context": response.handoff_context}],
                }

            builder.add_node(definition.name, run_agent)

        def route(state: ExecutionState) -> str:
            handoff = state.get("handoff_to")
            current = state.get("current_agent", workflow.entry_agent)
            if (handoff in workflow.targets_for(current)
                    and state.get("handoffs", 0) < state["max_handoffs"]):
                return handoff
            return END

        def count_handoff(state: ExecutionState):
            return {"handoffs": state.get("handoffs", 0) + 1}

        builder.add_node("handoff", count_handoff)
        builder.add_edge(START, workflow.entry_agent)
        for definition in agent_definitions:
            builder.add_conditional_edges(
                definition.name, route,
                {END: END, **{target: "handoff" for target in workflow.targets_for(definition.name)}},
            )
        builder.add_conditional_edges(
            "handoff",
            lambda state: state.get("handoff_to") or END,
            {END: END, **{item.name: item.name for item in agent_definitions}},
        )
        return builder.compile()

    async def execute(self, workflow_name: str, prompt: str) -> dict[str, Any]:
        """Run a registered workflow with the registered agents."""
        return await self.run(self.workflows.get(workflow_name), prompt)

    async def run(self, workflow: WorkflowDefinition, prompt: str,
                  agents: AgentRegistry | None = None) -> dict[str, Any]:
        """Run ``workflow`` and return a run record, including when the run fails.

        ``agents`` lets a caller supply its own definitions (for example from the platform
        database) instead of the registered ones. Unknown agents raise ``KeyError`` before
        anything runs; failures during the run are reported in the record's ``error``.
        """
        agents = agents if agents is not None else self.agents
        agents.get(workflow.entry_agent)
        for source, target in workflow.edges:
            agents.get(source)
            agents.get(target)

        run_id = str(uuid4())
        started_at = utc_now()
        clock = time.perf_counter()
        steps: list[StepTrace] = []
        graph = self._graph(workflow, agents, steps)
        final: dict[str, Any] = {}
        error: EngineError | None = None
        try:
            final = await asyncio.wait_for(
                graph.ainvoke({"prompt": prompt,
                               "current_agent": workflow.entry_agent, "handoff_to": None,
                               "handoffs": 0, "max_handoffs": workflow.max_handoffs,
                               "history": []}),
                timeout=self.policy.run_timeout_seconds,
            )
        except TimeoutError:
            running = next((step.agent for step in steps if step.duration_ms is None), None)
            error = EngineError(
                "run_timeout",
                f"The run did not finish within {self.policy.run_timeout_seconds:g} seconds.",
                retryable=True, agent=running)
        except Exception as exc:  # noqa: BLE001 - failures become the run record's error
            error = classify_error(exc)
        for step in steps:
            if step.duration_ms is None:
                step.finish("cancelled")

        price = self.prices.get(self.model_name) if self.model_name else None
        input_tokens = sum(step.input_tokens for step in steps)
        output_tokens = sum(step.output_tokens for step in steps)
        if error:
            status = STATUS_FAILED
        elif final.get("handoff_to"):
            # A handoff is only left pending when routing stopped at max_handoffs.
            status = STATUS_HANDOFF_LIMIT_REACHED
        else:
            status = STATUS_COMPLETED
        record = {
            "run_id": run_id, "status": status, "workflow": workflow.name,
            "result": "" if error else final.get("result", ""),
            "handoffs": max(len(steps) - 1, 0) if error else final.get("handoffs", 0),
            "history": [step.as_dict(price) for step in steps],
            "started_at": started_at, "finished_at": utc_now(), "duration_ms": ms_since(clock),
            "model": self.model_name,
            "usage": {
                "input_tokens": input_tokens, "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "model_calls": sum(step.model_calls for step in steps),
                "retries": sum(step.retries for step in steps),
                "tool_calls": sum(len(step.tool_calls) for step in steps),
            },
            "estimated_cost_usd": price.cost(input_tokens, output_tokens) if price else None,
            "error": error.as_dict() if error else None,
        }
        if error:
            logger.warning("run=%s workflow=%s status=failed code=%s agent=%s duration_ms=%d: %s",
                           run_id, workflow.name, error.code, error.agent,
                           record["duration_ms"], error.message)
        else:
            logger.info("run=%s workflow=%s status=%s handoffs=%d tokens=%d duration_ms=%d",
                        run_id, workflow.name, status, record["handoffs"],
                        record["usage"]["total_tokens"], record["duration_ms"])
        return record
