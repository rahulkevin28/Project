# AI Workflow Engine

This standalone Python module provides the AI workflow and agent contribution for the project. The GitHub repository was empty when inspected, so this module does not assume a Java backend or React frontend layout.

## Included

- FastAPI endpoints for agent and workflow registration, updates, deletion, discovery, and execution.
- A LangGraph-backed planner, researcher, and writer example workflow with bounded agent-to-agent handoffs.
- Registries for specialised agents, workflows, and explicitly approved tools.
- A model/tool loop for LangChain tools.
- OpenAI, Anthropic Claude, and Google Gemini chat model adapters selected through environment configuration.
- Tests that use a fake model and do not require paid API credentials.

## Setup

Requires Python 3.11 or newer.

From the folder containing `pyproject.toml`:

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
python -m pip install -e '.[dev]'
cp .env.example .env            # Windows: copy .env.example .env
# Add the selected provider's key to .env
uvicorn engine.main:app --reload --reload-dir engine --host 127.0.0.1 --port 8765
```

Then open <http://127.0.0.1:8765/> for the console, or <http://127.0.0.1:8765/docs> for the interactive API documentation. `--reload-dir engine` restarts the server when code under `engine/` changes; it does not watch `.env`, so restart manually after editing settings. `python -m engine.main` also serves on port 8765.

## Console

The root URL redirects to `/console/`, a browser console served by this service. It is plain HTML, CSS, and JavaScript in `engine/console/`, with no build step or Node dependency, and it calls only this service's own JSON API.

- **Run**: pick a workflow, write a prompt (or pick one of 10 examples), and press **Run workflow** or `Cmd`/`Ctrl` + `Enter`. While the run is in progress, the workflow graph lights up live: agents that have finished are highlighted, the agent working now pulses, and each step appears as soon as it finishes. The result shows the status, the answer, each agent's step with its handoff notes, and the path taken through the workflow graph. Recent runs stay in the browser tab only and are not saved.
- **Workflows**: view each workflow as a graph, then create, edit, delete, or run it. The editor previews the graph as you add handoffs and flags self-handoffs, duplicates, and agents that can't be reached.
- **Agents**: create, edit, and delete agents, approve registered tools, and see which workflows use each agent. The editor shows the grounding rules that are always added to an agent's instructions.

The header shows whether the engine is online and which provider and model are configured. `GET /info` supplies that, and it never includes API keys. Each run shows its time, tokens, estimated cost, and retries, and each step shows its own figures and any tool calls. Failed runs show the error code, a hint, and a **Try again** button when the error is safe to retry. If the engine has a token set, the console asks for it once and keeps it in that browser tab only.

The console is a development and operations tool for this module; the platform's main frontend can call the same API. The API exposes `/health`, `/info`, `/agents`, `/tools`, `/workflows`, `POST /workflows/{workflow_name}/execute` with `{"prompt":"..."}`, `POST /runs`, and streaming versions of both run routes (see [Live progress](#live-progress)). All routes are listed in `/docs`. Registry changes live in memory and disappear when the process restarts; see [Platform integration](#platform-integration) for how the backend can own storage instead. User accounts, permissions, and rate limits belong in the platform backend.

## Add an agent, tool, or workflow

Register each `AgentDefinition` with a unique name and system prompt. Register LangChain `BaseTool` instances with `ToolRegistry`, then list approved tool names in the agent definition. A tool is never exposed just because it exists in the process. If a model calls a tool outside its agent's approved list, the tool does not run and the model gets an error message back instead.

Agents can request a handoff through the typed `handoff_to_agent` tool. The receiving agent gets the original user request, marked as the source of truth, followed by every handoff note written so far in the run. Supplied facts such as policy wording therefore reach every agent in the user's own words, not only in another agent's paraphrase. Workflow `edges` define which handoffs are allowed, which maps directly to the connections shown in a visual workflow editor. The graph records agent outputs and bounds transitions using `max_handoffs`. The example researcher uses the model's own knowledge; it does not perform web search or cite external sources. Add an approved search integration only when the product's data source and credentials are agreed.

Workflow registration example:

```json
{
  "name": "research_then_write",
  "description": "Research a request and draft a response",
  "entry_agent": "planner",
  "max_handoffs": 4,
  "edges": [
    {"source": "planner", "target": "researcher"},
    {"source": "planner", "target": "writer"},
    {"source": "researcher", "target": "writer"}
  ]
}
```

## Grounding rules

Every agent's system prompt, including agents registered through `POST /agents`, ends with engine-wide grounding rules defined in `engine/agents.py` (`GROUNDING_RULES`). Agents must treat the user's request, handoff notes, and approved tool results as the only sources of facts about the user's situation or policies. They must not invent policy terms, conditions, exceptions, deadlines, or fees. They must say when something is not stated, and label any assumption or general knowledge as such rather than presenting it as confirmed. A registered agent's own prompt cannot remove these rules.

Prompt rules reduce invented details but cannot guarantee their absence. Review generated answers before showing them to customers, especially for policy, legal, or financial questions.

## Run results

`POST /workflows/{workflow_name}/execute` and `POST /runs` return the same run record:

| Field | Meaning |
|---|---|
| `run_id` | Unique ID for this run. |
| `status` | `completed`, `handoff_limit_reached`, or `failed`. |
| `workflow`, `model` | The workflow name and the configured model ID. |
| `result` | The final answer. Empty when the run failed or stopped at the handoff limit. |
| `handoffs` | Handoffs made. |
| `started_at`, `finished_at`, `duration_ms` | UTC timestamps and the total time. |
| `usage` | `input_tokens`, `output_tokens`, `total_tokens`, `model_calls`, `retries`, and `tool_calls` for the whole run. |
| `estimated_cost_usd` | Estimated cost, or `null` when `MODEL_PRICES` has no price for the model. |
| `error` | `null`, or `{code, message, retryable, agent}` when the run failed. |
| `history` | One entry per agent step, in order (see below). |

Each `history` entry has `agent`, `status` (`completed`, `failed`, or `cancelled`), `result`, `handoff_to`, `handoff_context`, `started_at`, `duration_ms`, `model_calls`, `retries`, `usage`, `estimated_cost_usd`, `error`, and `tool_calls`. Each tool call has `name`, `status` (`ok`, `error`, or `rejected`), `duration_ms`, and an `error` message when it didn't succeed. Tool arguments and results are not included.

`handoff_limit_reached` means an agent asked for another handoff after `max_handoffs` was used up; the last `history` entry shows the pending handoff.

### Failures, retries, and error codes

Model calls time out after `MODEL_TIMEOUT_SECONDS` (5 minutes by default) and the whole run after `RUN_TIMEOUT_SECONDS` (15 minutes). The limits are generous because thinking models can be slow: in testing, a single `gemini-3.8-flash` call took 40 to 100 seconds, and the default workflow makes one call per agent step. Timeouts, rate limits, and provider outages are retried up to `MODEL_MAX_RETRIES` times with exponential backoff, and every retry is counted in `usage.retries`. Bad keys and rejected requests are not retried. When a tool fails or times out, the error goes back to the agent as a tool message so it can recover; the run doesn't fail.

A failed run still returns its full run record, plus a `detail` message, with this HTTP status:

| `error.code` | HTTP | Retryable | Usual cause |
|---|---|---|---|
| `model_auth_failed` | 502 | No | Wrong or missing API key. |
| `model_request_rejected` | 502 | No | Unknown `LLM_MODEL`, or a request the provider refused. |
| `model_rate_limited` | 503 | Yes | The provider's rate limit. |
| `model_unavailable` | 502 | Yes | Provider outage, overload, or network error. |
| `model_timeout` | 504 | Yes | The model didn't reply within `MODEL_TIMEOUT_SECONDS`. |
| `run_timeout` | 504 | Yes | The run didn't finish within `RUN_TIMEOUT_SECONDS`. |
| `agent_tool_limit` | 502 | No | An agent used all its tool rounds without answering. |
| `model_error` | 502 | No | Another provider error. |
| `internal_error` | 500 | No | A bug in the engine; check the server log. |

Every run writes one log line with its `run_id`, status, tokens, and duration, so platform logs can be matched to run records. Error messages are redacted before they are logged or returned.

## Live progress

`POST /workflows/{workflow_name}/execute/stream` and `POST /runs/stream` take the same request bodies as their non-streaming versions, but respond with [server-sent events](https://developer.mozilla.org/docs/Web/API/Server-sent_events) as the run happens. A frontend can use them to show which agent is working right now.

| Event | When | Data |
|---|---|---|
| `run_started` | Before the first agent runs | `run_id`, `workflow`, `model`, `started_at` |
| `step_started` | An agent starts working | `run_id`, `index`, `agent`, `started_at` |
| `step_finished` | An agent finishes or fails | `run_id`, `index`, `step` (the same object as a `history` entry) |
| `run_finished` | The run is over | `run_id`, `run` (the full run record) |

Each event is sent as `event: <type>` followed by `data: <json>`. A `: keep-alive` comment line is sent every 15 seconds during long model calls, so proxies don't close the connection; clients should ignore it. The stream itself always returns HTTP 200: a failed run ends with a `run_finished` event whose record has `status: "failed"` and an `error`. Problems found before the run starts, such as an unknown workflow (404), invalid definitions (422), or a missing token (401), return a normal JSON error instead of a stream. If the client disconnects, the run is cancelled so it stops using the model.

Browsers' built-in `EventSource` only sends GET requests without custom headers, so use `fetch` and read the response body as a stream (the console's `streamRun` in `engine/console/app.js` is a working example).

## Platform integration

The Java service owns users, permissions, and durable agent and workflow records. This service runs workflows and reports what happened.

**Service token.** Set `ENGINE_API_TOKEN` to a long random value on both services. The backend then sends `Authorization: Bearer <token>` on every call. `/health`, the console page, and `/docs` stay open; everything else returns 401 without the token. Without `ENGINE_API_TOKEN` the API is open, which is only suitable for your own machine.

**Storage.** `POST /runs` runs a workflow from definitions in the request, so the backend can keep agents and workflows in PostgreSQL and send them with each run. Nothing is registered or stored by this service:

```json
{
  "prompt": "A customer asks whether they can return a product. The policy allows returns within 30 days of purchase.",
  "workflow": {"name": "support", "description": "Support replies", "entry_agent": "planner",
               "max_handoffs": 2, "edges": [{"source": "planner", "target": "writer"}]},
  "agents": [
    {"name": "planner", "description": "Plans", "system_prompt": "Plan the reply."},
    {"name": "writer", "description": "Writes", "system_prompt": "Write the reply."}
  ]
}
```

The request is checked the same way as registration: every agent the workflow uses must be supplied, names must be unique, and tools must be registered in this service. The backend should store the returned run record.

**Docker.** The `Dockerfile` builds a slim Python 3.12 image that runs as a non-root user on port 8000, with a health check on `/health`. Settings come from environment variables; `.env` is never copied into the image.

```bash
docker build -t ai-workflow-engine .
docker run --rm -p 8765:8000 --env-file .env ai-workflow-engine
```

A Docker Compose service for the platform could look like this, with secrets supplied by the platform's own environment:

```yaml
ai-engine:
  build: ./ai_workflow_engine
  environment:
    LLM_PROVIDER: anthropic
    LLM_MODEL: claude-haiku-4-5-20251001
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ENGINE_API_TOKEN: ${ENGINE_API_TOKEN}
  expose:
    - "8000"
```

## Configuration

All settings are environment variables (or lines in `.env` for local development). See `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `openai`, `anthropic`, or `google` (also `gemini`). |
| `LLM_MODEL` | `gpt-4o-mini` | Model ID for the provider. |
| `LLM_TEMPERATURE` | `0` | Sampling temperature. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` | — | Key for the selected provider. |
| `ENGINE_API_TOKEN` | — | Shared secret required on API calls when set. |
| `MODEL_TIMEOUT_SECONDS` | `300` | Limit for each model call. |
| `MODEL_MAX_RETRIES` | `2` | Retries for retryable model errors. |
| `TOOL_TIMEOUT_SECONDS` | `30` | Limit for each tool call. |
| `RUN_TIMEOUT_SECONDS` | `900` | Limit for a whole run. |
| `MODEL_PRICES` | — | JSON map of model ID to `input_per_million` and `output_per_million` prices in USD, for cost estimates. |
| `LOG_LEVEL` | `INFO` | Log level. |

`WorkflowExecutor` accepts a `BaseChatModel`, so alternative LangChain-compatible providers can be supplied without changing graph logic. The built-in provider factory supports `LLM_PROVIDER=openai`, `LLM_PROVIDER=anthropic`, and `LLM_PROVIDER=google` (also `gemini`).

To use Claude, set `LLM_PROVIDER=anthropic`, `LLM_MODEL=claude-haiku-4-5-20251001`, and `ANTHROPIC_API_KEY` in `.env`. Create the key in the Anthropic Console; a Claude web subscription is separate from API access. To use Gemini, set `LLM_PROVIDER=google`, `LLM_MODEL=gemini-3.8-flash`, and `GOOGLE_API_KEY`. Restart the server after changing `.env`. API keys are read only from environment variables; `.env` is local configuration and must not be committed.

## Verify

```bash
python -m pytest
ruff check engine tests
```

The tests use scripted fake models, so they make no external model calls and need no API keys. They cover handoff routing and inputs, grounding rules, tool approval, handoff limits, retries, timeouts, error codes, tool failures, usage and cost recording, live progress events and streaming, the service token, `POST /runs`, provider configuration, credential redaction, the management API, and serving the console.
