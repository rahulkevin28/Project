"""Runnable example service; replace the sample agents with domain agents."""

import logging

from .agents import AgentDefinition, AgentRegistry
from .api import create_app
from .config import get_settings
from .execution import WorkflowExecutor
from .providers import create_chat_model
from .tools import ToolRegistry
from .workflows import WorkflowDefinition, WorkflowRegistry

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper(),
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# HTTP client libraries log every request URL at INFO; keep them quiet so provider URLs
# (which can carry credentials) don't end up in the logs.
for _noisy in ("httpx", "httpcore", "httpx2"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

agents = AgentRegistry()
agents.register(AgentDefinition(
    name="planner", description="Plans work and delegates it to an appropriate specialist.",
    system_prompt=(
        "You coordinate a small team of specialist agents. Decide whether to answer directly "
        "or delegate a clearly scoped next step with the handoff_to_agent tool. In the "
        "handoff context, quote any facts the user supplied (such as policy wording) exactly "
        "and keep them separate from your own plan. Do not invent tool results."
    ),
))
agents.register(AgentDefinition(
    name="researcher", description="Produces a concise evidence-aware research brief.",
    system_prompt=(
        "You are a research specialist. Prepare a concise brief that first lists what the "
        "user's request and handoff notes actually state, then lists the open questions they "
        "do not answer. You may add general model knowledge only when it is labelled as "
        "general information, and you must never imply that you searched the web. Delegate to "
        "writer when the brief is ready for a user-facing response."
    ),
))
agents.register(AgentDefinition(
    name="writer", description="Turns the user request and specialist notes into a clear answer.",
    system_prompt=(
        "You are a response-writing specialist. Write a clear, helpful answer using only the "
        "original user request and the specialist notes. When a policy or document is "
        "supplied, state only what it says. If the question depends on something it does not "
        "cover, say so and suggest confirming with the business. Do not claim to have "
        "performed external actions."
    ),
))
workflows = WorkflowRegistry()
workflows.register(WorkflowDefinition(
    name="default", description="A planner, researcher, and writer workflow with bounded handoffs.",
    entry_agent="planner", max_handoffs=4,
    edges=(("planner", "researcher"), ("planner", "writer"),
           ("researcher", "writer")),
))
tools = ToolRegistry()
executor = WorkflowExecutor(
    agents, workflows, tools, create_chat_model(settings),
    policy=settings.execution_policy(), model_name=settings.llm_model,
    prices=settings.model_prices,
)
if not settings.engine_api_token:
    logging.getLogger("engine").warning(
        "ENGINE_API_TOKEN is not set, so the API accepts requests without a token. "
        "Set it before running the engine anywhere other than your own machine."
    )
app = create_app(agents, workflows, tools, executor,
                 model_info={"provider": settings.llm_provider, "model": settings.llm_model},
                 api_token=settings.engine_api_token or None)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("engine.main:app", host="127.0.0.1", port=8765,
                log_level=settings.log_level.lower())
