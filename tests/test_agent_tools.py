import pytest
from langchain_core.messages import AIMessage
from langchain_core.tools import tool

from engine.agents import GROUNDING_RULES, AgentDefinition, AgentRegistry
from engine.tools import ToolRegistry


class ToolCallingModel:
    def bind_tools(self, tools):
        self.tool_names = [item.name for item in tools]
        return self

    async def ainvoke(self, messages):
        if not any(message.type == "tool" for message in messages):
            return AIMessage(content="", tool_calls=[{
                "name": "add_numbers",
                "args": {"a": 4, "b": 6},
                "id": "call-1",
                "type": "tool_call",
            }])
        return AIMessage(content=f"The sum is {messages[-1].content}.")


@pytest.mark.asyncio
async def test_agent_runs_only_registered_tools():
    @tool
    def add_numbers(a: int, b: int) -> int:
        """Add two whole numbers."""
        return a + b

    tools = ToolRegistry()
    tools.register(add_numbers)
    agents = AgentRegistry()
    agents.register(AgentDefinition("calculator", "Calculates", "Use tools for arithmetic.",
                                    tool_names=("add_numbers",)))

    result = await agents.invoke("calculator", "What is 4 plus 6?", ToolCallingModel(), tools)

    assert result.content == "The sum is 10."
    assert result.handoff_to is None


@pytest.mark.asyncio
async def test_agent_rejects_unknown_handoff_targets():
    class InvalidHandoffModel:
        def bind_tools(self, tools):
            self.calls = 0
            return self

        async def ainvoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                return AIMessage(content="", tool_calls=[{
                    "name": "handoff_to_agent",
                    "args": {"target_agent": "not_registered", "context": "Do this."},
                    "id": "handoff-1",
                    "type": "tool_call",
                }])
            return AIMessage(content="I will handle it myself.")

    agents = AgentRegistry()
    agents.register(AgentDefinition("planner", "Plans", "Plan"))
    result = await agents.invoke("planner", "Help", InvalidHandoffModel(), ToolRegistry())

    assert result.handoff_to is None
    assert result.content == "I will handle it myself."


@pytest.mark.asyncio
@pytest.mark.parametrize("requested_tool", ["delete_records", "made_up_tool"])
async def test_agent_cannot_run_tools_outside_its_approved_list(requested_tool):
    deleted = []

    @tool
    def add_numbers(a: int, b: int) -> int:
        """Add two whole numbers."""
        return a + b

    @tool
    def delete_records(table: str) -> str:
        """Delete every record in a table."""
        deleted.append(table)
        return "deleted"

    class UnapprovedToolModel:
        def bind_tools(self, tools):
            self.tool_names = [item.name for item in tools]
            return self

        async def ainvoke(self, messages):
            if not any(message.type == "tool" for message in messages):
                return AIMessage(content="", tool_calls=[{
                    "name": requested_tool, "args": {"table": "customers"},
                    "id": "call-1", "type": "tool_call",
                }])
            return AIMessage(content=messages[-1].content)

    tools = ToolRegistry()
    tools.register(add_numbers)
    tools.register(delete_records)
    agents = AgentRegistry()
    agents.register(AgentDefinition("calculator", "Calculates", "Use tools for arithmetic.",
                                    tool_names=("add_numbers",)))
    model = UnapprovedToolModel()

    result = await agents.invoke("calculator", "Clear the customers table.", model, tools)

    assert deleted == []
    assert "delete_records" not in model.tool_names
    assert "not approved for this agent" in result.content


@pytest.mark.asyncio
async def test_every_agent_receives_the_grounding_rules():
    class RecordingModel:
        def bind_tools(self, tools):
            return self

        async def ainvoke(self, messages):
            self.system_prompt = messages[0].content
            return AIMessage(content="Done.")

    agents = AgentRegistry()
    agents.register(AgentDefinition("custom", "Registered at runtime", "Answer support questions."))
    model = RecordingModel()

    await agents.invoke("custom", "Can I return this?", model, ToolRegistry())

    assert model.system_prompt.startswith("Answer support questions.")
    assert GROUNDING_RULES in model.system_prompt
    assert "Never invent policy terms" in model.system_prompt


@pytest.mark.asyncio
async def test_agent_reads_text_from_content_block_replies():
    class BlockReplyModel:
        def bind_tools(self, tools):
            return self

        async def ainvoke(self, messages):
            return AIMessage(content=[
                {"type": "text", "text": "Returns are allowed "},
                {"type": "text", "text": "within 30 days."},
            ])

    agents = AgentRegistry()
    agents.register(AgentDefinition("writer", "Writes", "Write"))

    result = await agents.invoke("writer", "Summarise the policy.", BlockReplyModel(),
                                 ToolRegistry())

    assert result.content == "Returns are allowed within 30 days."
