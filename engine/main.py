"""Runnable example service; replace the sample agents with domain agents."""

from .agents import AgentDefinition, AgentRegistry
from .api import create_app
from .config import get_settings
from .execution import WorkflowExecutor
from .providers import create_chat_model
from .tools import ToolRegistry
from .workflows import WorkflowDefinition, WorkflowRegistry

agents = AgentRegistry()
agents.register(AgentDefinition(
    name="planner", description="Breaks a request into a clear response.",
    system_prompt=("You are a careful planning agent. Answer the user's request concisely. "
                   "When another specialised agent should take over, end with HANDOFF: agent_name."),
))
workflows = WorkflowRegistry()
workflows.register(WorkflowDefinition(
    name="default", description="A minimal workflow starting with the planner agent.",
    entry_agent="planner",
))
tools = ToolRegistry()
executor = WorkflowExecutor(agents, workflows, tools, create_chat_model())
app = create_app(agents, workflows, tools, executor)

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("engine.main:app", host="127.0.0.1", port=8000,
                log_level=settings.log_level.lower())
