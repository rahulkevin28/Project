"""LangGraph-backed execution with explicit inter-agent handoff decisions."""

from typing import Annotated, Any, TypedDict

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, START, StateGraph

from .agents import AgentRegistry
from .tools import ToolRegistry
from .workflows import WorkflowDefinition, WorkflowRegistry


def _append(left: list[dict[str, Any]], right: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return left + right


class ExecutionState(TypedDict, total=False):
    prompt: str
    current_agent: str
    result: str
    handoffs: int
    max_handoffs: int
    history: Annotated[list[dict[str, Any]], _append]


class WorkflowExecutor:
    def __init__(self, agents: AgentRegistry, workflows: WorkflowRegistry,
                 tools: ToolRegistry, model: BaseChatModel) -> None:
        self.agents = agents
        self.workflows = workflows
        self.tools = tools
        self.model = model

    def _graph(self, workflow: WorkflowDefinition):
        builder = StateGraph(ExecutionState)
        agent_definitions = self.agents.list()
        for definition in agent_definitions:
            async def run_agent(state: ExecutionState, agent_name: str = definition.name):
                result = await self.agents.invoke(agent_name, state["prompt"], self.model, self.tools)
                return {"result": result, "current_agent": agent_name,
                        "history": [{"agent": agent_name, "result": result}]}

            builder.add_node(definition.name, run_agent)

        def route(state: ExecutionState) -> str:
            result = state.get("result", "")
            handoff = self._handoff_target(result)
            if handoff and state.get("handoffs", 0) < state["max_handoffs"]:
                self.agents.get(handoff)  # Validate target before graph routing.
                return handoff
            return END

        def count_handoff(state: ExecutionState):
            return {"handoffs": state.get("handoffs", 0) + 1}

        builder.add_node("handoff", count_handoff)
        builder.add_edge(START, workflow.entry_agent)
        for definition in self.agents.list():
            builder.add_conditional_edges(definition.name, route, {END: END,
                                          **{item.name: "handoff" for item in self.agents.list()}})
        builder.add_conditional_edges(
            "handoff",
            lambda state: self._handoff_target(state["result"]) or END,
            {END: END, **{item.name: item.name for item in agent_definitions}},
        )
        return builder.compile()

    @staticmethod
    def _handoff_target(result: str) -> str | None:
        """Recognize an explicit handoff directive emitted as the final line: HANDOFF: agent_name."""
        for line in reversed(result.splitlines()):
            if line.strip().startswith("HANDOFF:"):
                return line.split(":", 1)[1].strip() or None
        return None

    async def execute(self, workflow_name: str, prompt: str) -> dict[str, Any]:
        workflow = self.workflows.get(workflow_name)
        self.agents.get(workflow.entry_agent)
        graph = self._graph(workflow)
        final = await graph.ainvoke({"prompt": prompt, "current_agent": workflow.entry_agent,
                                     "handoffs": 0, "max_handoffs": workflow.max_handoffs,
                                     "history": []})
        return {"workflow": workflow.name, "result": final.get("result", ""),
                "history": final.get("history", []), "handoffs": final.get("handoffs", 0)}
