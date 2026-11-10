import pytest

from engine.agents import AgentDefinition, AgentRegistry
from engine.tools import ToolRegistry
from engine.workflows import WorkflowDefinition, WorkflowRegistry


def test_agent_registry_rejects_duplicate_names():
    registry = AgentRegistry()
    agent = AgentDefinition("planner", "Plans", "Plan carefully")
    registry.register(agent)
    with pytest.raises(ValueError, match="already registered"):
        registry.register(agent)


def test_workflow_registry_lookup_and_unknown_name():
    registry = WorkflowRegistry()
    registry.register(WorkflowDefinition("default", "Default", "planner"))
    assert registry.get("default").entry_agent == "planner"
    with pytest.raises(KeyError, match="Unknown workflow"):
        registry.get("missing")


def test_tool_registry_resolves_only_registered_tools():
    registry = ToolRegistry()
    with pytest.raises(KeyError, match="Unknown tool"):
        registry.get("unapproved")
