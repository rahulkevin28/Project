import pytest

from engine.agents import AgentDefinition, AgentRegistry
from engine.execution import WorkflowExecutor
from engine.tools import ToolRegistry
from engine.workflows import WorkflowDefinition, WorkflowRegistry


class FakeModel:
    def __init__(self):
        self.calls = 0

    async def ainvoke(self, messages):
        from langchain_core.messages import AIMessage

        self.calls += 1
        text = "Final answer"
        if self.calls == 1:
            text = "Delegating.\nHANDOFF: researcher"
        return AIMessage(content=text)


@pytest.mark.asyncio
async def test_workflow_hands_off_between_registered_agents():
    agents = AgentRegistry()
    agents.register(AgentDefinition("planner", "Plans", "Plan"))
    agents.register(AgentDefinition("researcher", "Researches", "Research"))
    workflows = WorkflowRegistry()
    workflows.register(WorkflowDefinition("demo", "Demo", "planner"))
    executor = WorkflowExecutor(agents, workflows, ToolRegistry(), FakeModel())

    result = await executor.execute("demo", "Do the task")

    assert result["result"] == "Final answer"
    assert [entry["agent"] for entry in result["history"]] == ["planner", "researcher"]
    assert result["handoffs"] == 1


def test_handoff_directive_is_explicit():
    assert WorkflowExecutor._handoff_target("Answer\nHANDOFF: writer") == "writer"
    assert WorkflowExecutor._handoff_target("Answer without delegation") is None
