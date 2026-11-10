import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from engine.agents import GROUNDING_RULES, AgentDefinition, AgentRegistry
from engine.api import create_app
from engine.execution import WorkflowExecutor
from engine.runtime import ExecutionPolicy
from engine.runtime import redact as _safe_error_message
from engine.tools import ToolRegistry
from engine.workflows import WorkflowRegistry

TEST_TOKEN = "test-engine-token"


class NoCallModel:
    def bind_tools(self, tools):
        return self


class AnswerModel:
    """Answers every call immediately, or raises ``error`` if one is given."""

    def __init__(self, error=None):
        self.error = error

    def bind_tools(self, tools):
        return self

    async def ainvoke(self, messages):
        if self.error:
            raise self.error
        return AIMessage(content=f"Answer to: {messages[-1].content}")


class AuthError(Exception):
    status_code = 401


def make_client(model_info=None, model=None, api_token=None):
    agents = AgentRegistry()
    agents.register(AgentDefinition("planner", "Plans", "Plan"))
    agents.register(AgentDefinition("writer", "Writes", "Write"))
    workflows = WorkflowRegistry()
    tools = ToolRegistry()
    policy = ExecutionPolicy(model_max_retries=0, retry_backoff_seconds=0)
    executor = WorkflowExecutor(agents, workflows, tools, model or NoCallModel(), policy=policy)
    return TestClient(create_app(agents, workflows, tools, executor, model_info=model_info,
                                 api_token=api_token))


INLINE_RUN = {
    "prompt": "Can I return this?",
    "workflow": {"name": "support", "description": "Support", "entry_agent": "support_agent"},
    "agents": [{"name": "support_agent", "description": "Answers support questions",
                "system_prompt": "Answer using only the supplied policy."}],
}


def test_api_token_is_required_on_every_route_except_health_console_and_docs():
    with make_client(api_token=TEST_TOKEN) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/console/").status_code == 200
        assert client.get("/docs").status_code == 200

        for path in ("/info", "/agents", "/workflows", "/tools"):
            missing = client.get(path)
            assert missing.status_code == 401, path
            assert missing.headers["www-authenticate"] == "Bearer"
        assert client.post("/runs", json=INLINE_RUN).status_code == 401
        wrong = client.get("/agents", headers={"Authorization": "Bearer wrong-token"})
        assert wrong.status_code == 401

        allowed = client.get("/agents", headers={"Authorization": f"Bearer {TEST_TOKEN}"})
        assert allowed.status_code == 200
        info = client.get("/info", headers={"Authorization": f"Bearer {TEST_TOKEN}"}).json()
        assert info["auth_required"] is True


def test_without_a_token_configured_the_api_stays_open_for_local_development():
    with make_client() as client:
        assert client.get("/agents").status_code == 200
        assert client.get("/info").json()["auth_required"] is False


def test_runs_endpoint_executes_supplied_definitions_without_registering_them():
    with make_client(model=AnswerModel()) as client:
        response = client.post("/runs", json=INLINE_RUN)
        agent_names = [agent["name"] for agent in client.get("/agents").json()]
        workflow_names = [workflow["name"] for workflow in client.get("/workflows").json()]

    assert response.status_code == 200
    run = response.json()
    assert run["status"] == "completed"
    assert run["workflow"] == "support"
    assert run["result"] == "Answer to: Can I return this?"
    assert run["history"][0]["agent"] == "support_agent"
    assert "support_agent" not in agent_names
    assert "support" not in workflow_names


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"workflow": {**INLINE_RUN["workflow"], "entry_agent": "missing_agent"}},
         "not supplied: missing_agent"),
        ({"agents": [{**INLINE_RUN["agents"][0], "tool_names": ["missing_tool"]}]},
         "Unknown tool 'missing_tool'"),
        ({"agents": INLINE_RUN["agents"] * 2}, "Agent names must be unique"),
    ],
)
def test_runs_endpoint_rejects_incomplete_definitions(change, message):
    with make_client(model=AnswerModel()) as client:
        response = client.post("/runs", json={**INLINE_RUN, **change})

    assert response.status_code == 422
    assert message in str(response.json()["detail"])


def test_failed_runs_return_the_run_record_with_a_matching_status_code():
    with make_client(model=AnswerModel(error=AuthError("Invalid API key"))) as client:
        response = client.post("/runs", json=INLINE_RUN)

    assert response.status_code == 502
    body = response.json()
    assert body["status"] == "failed"
    assert body["run_id"]
    assert body["detail"] == "Invalid API key"
    assert body["error"]["code"] == "model_auth_failed"
    assert body["history"][0]["status"] == "failed"


def test_root_redirects_to_the_console_and_serves_its_files():
    with make_client() as client:
        home = client.get("/", follow_redirects=False)
        assert home.status_code == 307
        assert home.headers["location"] == "/console/"

        page = client.get("/console/")
        assert page.status_code == 200
        assert "text/html" in page.headers["content-type"]
        assert "AI Workflow Console" in page.text
        for asset in ("app.js", "styles.css"):
            assert client.get(f"/console/{asset}").status_code == 200
        assert client.get("/docs").status_code == 200


def test_info_reports_provider_and_model_but_no_credentials():
    with make_client({"provider": "google", "model": "gemini-3.8-flash"}) as client:
        info = client.get("/info").json()

    assert info["provider"] == "google"
    assert info["model"] == "gemini-3.8-flash"
    assert info["grounding_rules"] == GROUNDING_RULES
    assert not any("key" in field.lower() for field in info)


def test_agent_details_include_instructions_for_editing():
    with make_client() as client:
        details = client.get("/agents/planner")
        missing = client.get("/agents/missing")

    assert details.status_code == 200
    assert details.json() == {"name": "planner", "description": "Plans", "tools": [],
                              "system_prompt": "Plan", "max_tool_rounds": 5}
    assert missing.status_code == 404


def test_provider_error_logging_redacts_api_credentials():
    error = Exception("Incorrect API key provided: sk-proj-1234567890abcdef")
    safe_message = _safe_error_message(error)
    assert "sk-proj-1234567890abcdef" not in safe_message
    assert "[REDACTED_API_KEY]" in safe_message


@pytest.mark.parametrize(
    ("message", "secret"),
    [
        ("Invalid x-api-key: sk-ant-api03-FAKEFAKEFAKE", "sk-ant-api03-FAKEFAKEFAKE"),
        ("API key not valid: AIzaFAKEFAKEFAKEFAKEFAKEFAKE12", "AIzaFAKEFAKEFAKEFAKEFAKEFAKE12"),
        ("Missing config GOOGLE_API_KEY=fake-google-value", "fake-google-value"),
        ("anthropic_api_key: fake-anthropic-value", "fake-anthropic-value"),
        ("POST /v1beta/models:generate?key=fake-query-value&alt=sse", "fake-query-value"),
        ("header x-goog-api-key: fake-header-value", "fake-header-value"),
    ],
)
def test_provider_error_logging_redacts_other_provider_credentials(message, secret):
    safe_message = _safe_error_message(Exception(message))
    assert secret not in safe_message
    assert "REDACTED" in safe_message


def test_agent_management_registers_agents_and_rejects_unknown_tools():
    with make_client() as client:
        created = client.post("/agents", json={
            "name": "researcher", "description": "Researches", "system_prompt": "Be careful.",
        })
        assert created.status_code == 201
        assert created.json()["name"] == "researcher"
        assert len(client.get("/agents").json()) == 3

        updated = client.put("/agents/researcher", json={
            "name": "researcher", "description": "Careful researcher",
            "system_prompt": "Be careful and state uncertainty.",
        })
        assert updated.status_code == 200
        assert updated.json()["description"] == "Careful researcher"

        duplicate = client.post("/agents", json={
            "name": "researcher", "description": "Duplicate", "system_prompt": "Duplicate.",
        })
        assert duplicate.status_code == 409

        unknown_tool = client.post("/agents", json={
            "name": "math_agent", "description": "Calculates", "system_prompt": "Calculate.",
            "tool_names": ["missing_tool"],
        })
        assert unknown_tool.status_code == 422


def test_workflow_management_accepts_graph_edges_between_registered_agents():
    with make_client() as client:
        created = client.post("/workflows", json={
            "name": "research_then_write", "description": "Research and write.",
            "entry_agent": "planner", "max_handoffs": 2,
            "edges": [{"source": "planner", "target": "writer"}],
        })
        assert created.status_code == 201
        assert created.json()["edges"] == [{"source": "planner", "target": "writer"}]

        updated = client.put("/workflows/research_then_write", json={
            "name": "research_then_write", "description": "Updated graph.",
            "entry_agent": "planner", "max_handoffs": 3,
            "edges": [{"source": "planner", "target": "writer"}],
        })
        assert updated.status_code == 200
        assert updated.json()["max_handoffs"] == 3

        invalid = client.post("/workflows", json={
            "name": "broken", "description": "Unknown agent.",
            "entry_agent": "planner", "edges": [{"source": "planner", "target": "missing"}],
        })
        assert invalid.status_code == 422

        unreachable = client.post("/workflows", json={
            "name": "unreachable", "description": "Disconnected graph.",
            "entry_agent": "planner", "edges": [{"source": "writer", "target": "planner"}],
        })
        assert unreachable.status_code == 422

        linked_delete = client.delete("/agents/writer")
        assert linked_delete.status_code == 409

