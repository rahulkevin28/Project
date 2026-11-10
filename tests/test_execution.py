import pytest
from langchain_core.messages import AIMessage

from engine.agents import AgentDefinition, AgentRegistry
from engine.execution import WorkflowExecutor
from engine.tools import ToolRegistry
from engine.workflows import WorkflowDefinition, WorkflowRegistry

POLICY_PROMPT = (
    "A customer asks whether they can return a product. "
    "The policy allows returns within 30 days of purchase."
)


class ScriptedModel:
    """Returns pre-written replies in order and records each agent's input."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.inputs = []

    def bind_tools(self, tools):
        self.available_tools = [tool.name for tool in tools]
        return self

    async def ainvoke(self, messages):
        self.inputs.append(messages[-1].content)
        return self.responses.pop(0)


def handoff(target, context, call_id="handoff-1"):
    return AIMessage(content="", tool_calls=[{
        "name": "handoff_to_agent",
        "args": {"target_agent": target, "context": context},
        "id": call_id,
        "type": "tool_call",
    }])


def make_executor(model, *edges, max_handoffs=8):
    agents = AgentRegistry()
    for name in {"planner", *(agent for edge in edges for agent in edge)}:
        agents.register(AgentDefinition(name, name.title(), name.title()))
    workflows = WorkflowRegistry()
    workflows.register(WorkflowDefinition(
        "demo", "Demo", "planner", max_handoffs=max_handoffs, edges=tuple(edges),
    ))
    return WorkflowExecutor(agents, workflows, ToolRegistry(), model)


@pytest.mark.asyncio
async def test_workflow_hands_off_between_registered_agents():
    model = ScriptedModel(handoff("researcher", "Research these details."),
                          AIMessage(content="Final answer"))
    executor = make_executor(model, ("planner", "researcher"))

    result = await executor.execute("demo", "Do the task")

    assert result["result"] == "Final answer"
    assert result["run_id"]
    assert result["status"] == "completed"
    assert [entry["agent"] for entry in result["history"]] == ["planner", "researcher"]
    assert result["handoffs"] == 1
    assert result["history"][0]["handoff_to"] == "researcher"
    assert result["history"][0]["handoff_context"] == "Research these details."
    assert result["history"][1]["handoff_to"] is None
    assert model.inputs[0] == "Do the task"
    assert "Do the task" in model.inputs[1]
    assert "Research these details." in model.inputs[1]


@pytest.mark.asyncio
async def test_every_receiving_agent_sees_the_original_request_and_all_notes():
    model = ScriptedModel(
        handoff("researcher", "Check what the return policy says.", "handoff-1"),
        handoff("writer", "The policy states a 30-day return window only.", "handoff-2"),
        AIMessage(content="Returns are allowed within 30 days of purchase."),
    )
    executor = make_executor(model, ("planner", "researcher"), ("researcher", "writer"))

    result = await executor.execute("demo", POLICY_PROMPT)

    writer_input = model.inputs[2]
    assert POLICY_PROMPT in writer_input
    assert "Check what the return policy says." in writer_input
    assert "The policy states a 30-day return window only." in writer_input
    assert writer_input.index(POLICY_PROMPT) < writer_input.index("Handoff notes")
    assert result["status"] == "completed"
    assert result["handoffs"] == 2


@pytest.mark.asyncio
async def test_run_reports_when_it_stops_at_the_handoff_limit():
    model = ScriptedModel(handoff("researcher", "Research these details."))
    executor = make_executor(model, ("planner", "researcher"), max_handoffs=0)

    result = await executor.execute("demo", "Do the task")

    assert result["status"] == "handoff_limit_reached"
    assert result["handoffs"] == 0
    assert [entry["agent"] for entry in result["history"]] == ["planner"]
    assert result["history"][0]["handoff_to"] == "researcher"
