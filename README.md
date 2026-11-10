# AI Workflow Engine

This standalone Python module provides the AI workflow and agent contribution for the project. The repository was empty when inspected, so the module is isolated under `ai_workflow_engine/` and does not assume a Java backend or React frontend layout.

## Included

- FastAPI endpoints for health, agent/tool/workflow discovery, and workflow execution.
- A LangGraph-backed workflow executor with bounded agent-to-agent handoffs.
- Registries for specialised agents, workflows, and explicitly approved tools.
- A model/tool loop for LangChain tools.
- OpenAI and Anthropic chat model adapters selected through environment configuration.
- Tests that use a fake model and do not require paid API credentials.

## Setup

Requires Python 3.11 or newer.

```bash
cd ai_workflow_engine
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
python -m pip install -e '.[dev]'
cp .env.example .env            # Windows: copy .env.example .env
# Add the selected provider's key to .env
uvicorn engine.main:app --reload
```

The sample service binds to `127.0.0.1:8000`. It exposes `/health`, `/agents`, `/tools`, `/workflows`, and `POST /workflows/{workflow_name}/execute` with `{"prompt":"..."}`. Do not expose this initial service publicly without adding the parent project's authentication, authorization, rate limits, and request auditing.

## Add an agent, tool, or workflow

Register each `AgentDefinition` with a unique name and system prompt. Register LangChain `BaseTool` instances with `ToolRegistry`, then list approved tool names in the agent definition. A tool is never exposed just because it exists in the process.

An agent can request a handoff by ending its response with `HANDOFF: agent_name`. The target must be registered. Workflows start at their configured `entry_agent` and stop after the workflow's `max_handoffs` limit, preventing unbounded delegation. Replace this text directive with a structured decision schema if the enclosing product needs stronger routing validation.

`WorkflowExecutor` accepts a `BaseChatModel`, so alternative LangChain-compatible providers can be supplied without changing graph logic. The built-in provider factory supports `LLM_PROVIDER=openai` and `LLM_PROVIDER=anthropic`. API keys are read only from environment variables; `.env` is local configuration and must not be committed.

## Verify

```bash
pytest
ruff check engine tests
```

The tests run without an external model call.
