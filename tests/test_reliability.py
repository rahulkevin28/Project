import asyncio

import pytest
from langchain_core.messages import AIMessage
from langchain_core.tools import tool

from engine.agents import AgentDefinition, AgentRegistry
from engine.execution import WorkflowExecutor
from engine.runtime import EngineError, ExecutionPolicy, ModelPrice, classify_error
from engine.tools import ToolRegistry
from engine.workflows import WorkflowDefinition, WorkflowRegistry

FAST = ExecutionPolicy(model_timeout_seconds=1, model_max_retries=2, retry_backoff_seconds=0,
                       tool_timeout_seconds=1, run_timeout_seconds=5)


class ProviderError(Exception):
    """Looks like an SDK error: it carries the HTTP status the provider returned."""

    def __init__(self, status_code):
        super().__init__(f"Provider returned {status_code}")
        self.status_code = status_code


class SequenceModel:
    """Plays back replies in order. Exceptions are raised; coroutines are awaited."""

    def __init__(self, *steps):
        self.steps = list(steps)
        self.calls = 0
        self.seen = []

    def bind_tools(self, tools):
        return self

    async def ainvoke(self, messages):
        self.calls += 1
        self.seen.append(list(messages))
        step = self.steps.pop(0)
        if isinstance(step, BaseException):
            raise step
        if callable(step):
            return await step(messages)
        return step


def reply(text="", input_tokens=0, output_tokens=0, tool_calls=None):
    return AIMessage(content=text, tool_calls=tool_calls or [], usage_metadata={
        "input_tokens": input_tokens, "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
    })


def call(name, args, call_id="call-1"):
    return {"name": name, "args": args, "id": call_id, "type": "tool_call"}


def executor_for(model, *, agents=("writer",), edges=(), tools=None, tool_names=(),
                 policy=FAST, prices=None, max_handoffs=4):
    registry = AgentRegistry()
    for name in agents:
        registry.register(AgentDefinition(name, name.title(), name.title(), tool_names=tool_names))
    workflows = WorkflowRegistry()
    workflows.register(WorkflowDefinition("demo", "Demo", agents[0], max_handoffs=max_handoffs,
                                          edges=tuple(edges)))
    return WorkflowExecutor(registry, workflows, tools or ToolRegistry(), model, policy=policy,
                            model_name="test-model", prices=prices)


@pytest.mark.asyncio
async def test_retryable_model_errors_are_retried_and_counted():
    model = SequenceModel(ProviderError(503), ProviderError(429), reply("Done", 10, 5))

    result = await executor_for(model).execute("demo", "Hi")

    assert result["status"] == "completed"
    assert result["result"] == "Done"
    assert model.calls == 3
    assert result["history"][0]["retries"] == 2
    assert result["usage"]["retries"] == 2
    assert result["usage"]["model_calls"] == 1
    assert result["error"] is None


@pytest.mark.asyncio
async def test_non_retryable_errors_fail_the_run_with_a_clear_code():
    model = SequenceModel(ProviderError(401))

    result = await executor_for(model).execute("demo", "Hi")

    assert model.calls == 1
    assert result["status"] == "failed"
    assert result["result"] == ""
    assert result["error"] == {"code": "model_auth_failed", "message": "Provider returned 401",
                               "retryable": False, "agent": "writer"}
    assert result["history"][0]["status"] == "failed"
    assert result["history"][0]["error"]["code"] == "model_auth_failed"


@pytest.mark.asyncio
async def test_slow_model_calls_time_out_after_retries():
    async def slow(messages):
        await asyncio.sleep(0.3)
        return reply("Too late")

    policy = ExecutionPolicy(model_timeout_seconds=0.05, model_max_retries=1,
                             retry_backoff_seconds=0, run_timeout_seconds=5)
    model = SequenceModel(slow, slow)

    result = await executor_for(model, policy=policy).execute("demo", "Hi")

    assert model.calls == 2
    assert result["status"] == "failed"
    assert result["error"]["code"] == "model_timeout"
    assert result["error"]["retryable"] is True
    assert result["history"][0]["retries"] == 1


@pytest.mark.asyncio
async def test_run_timeout_stops_long_runs_and_marks_the_step_cancelled():
    async def slow(messages):
        await asyncio.sleep(0.5)
        return reply("Too late")

    policy = ExecutionPolicy(model_timeout_seconds=5, model_max_retries=0,
                             retry_backoff_seconds=0, run_timeout_seconds=0.05)

    result = await executor_for(SequenceModel(slow), policy=policy).execute("demo", "Hi")

    assert result["status"] == "failed"
    assert result["error"]["code"] == "run_timeout"
    assert result["error"]["agent"] == "writer"
    assert result["history"][0]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_tool_errors_go_back_to_the_agent_instead_of_failing_the_run():
    @tool
    def order_lookup(order_id: str) -> str:
        """Look up an order."""
        raise RuntimeError("order database offline")

    tools = ToolRegistry()
    tools.register(order_lookup)
    model = SequenceModel(
        reply(tool_calls=[call("order_lookup", {"order_id": "A1"})]),
        lambda messages: asyncio.sleep(0, result=reply(f"Sorry: {messages[-1].content}")),
    )

    result = await executor_for(model, tools=tools, tool_names=("order_lookup",)).execute(
        "demo", "Where is order A1?")

    assert result["status"] == "completed"
    assert "order database offline" in result["result"]
    [tool_call] = result["history"][0]["tool_calls"]
    assert tool_call["name"] == "order_lookup"
    assert tool_call["status"] == "error"
    assert "order database offline" in tool_call["error"]
    assert model.seen[1][-1].status == "error"


@pytest.mark.asyncio
async def test_handoff_mixed_with_other_tool_calls_is_sent_back_to_the_model():
    model = SequenceModel(
        reply(tool_calls=[call("handoff_to_agent", {"target_agent": "writer", "context": "Go"},
                               "call-1"),
                          call("order_lookup", {"order_id": "A1"}, "call-2")]),
        reply("I'll answer directly."),
    )

    result = await executor_for(model, agents=("planner", "writer"),
                                edges=(("planner", "writer"),)).execute("demo", "Hi")

    assert result["status"] == "completed"
    assert result["result"] == "I'll answer directly."
    assert [item["status"] for item in result["history"][0]["tool_calls"]] == ["rejected"] * 2
    rejected = [message for message in model.seen[1] if message.type == "tool"]
    assert {message.tool_call_id for message in rejected} == {"call-1", "call-2"}


@pytest.mark.asyncio
async def test_usage_timing_and_cost_are_recorded_per_step_and_in_total():
    model = SequenceModel(
        reply(input_tokens=100, output_tokens=20, tool_calls=[
            call("handoff_to_agent", {"target_agent": "writer", "context": "Write it."})]),
        reply("Final", input_tokens=200, output_tokens=50),
    )
    prices = {"test-model": ModelPrice(input_per_million=1.0, output_per_million=5.0)}

    result = await executor_for(model, agents=("planner", "writer"),
                                edges=(("planner", "writer"),), prices=prices).execute("demo", "Hi")

    assert result["model"] == "test-model"
    assert result["usage"] == {"input_tokens": 300, "output_tokens": 70, "total_tokens": 370,
                               "model_calls": 2, "retries": 0, "tool_calls": 0}
    assert result["estimated_cost_usd"] == pytest.approx(0.00065)
    planner, writer = result["history"]
    assert planner["usage"] == {"input_tokens": 100, "output_tokens": 20, "total_tokens": 120}
    assert planner["estimated_cost_usd"] == pytest.approx(0.0002)
    assert writer["status"] == "completed"
    for entry in (planner, writer):
        assert isinstance(entry["duration_ms"], int)
        assert entry["started_at"].endswith("Z")
    assert result["started_at"] <= result["finished_at"]


@pytest.mark.asyncio
async def test_cost_is_left_empty_without_a_price_for_the_model():
    result = await executor_for(SequenceModel(reply("Done", 10, 5))).execute("demo", "Hi")

    assert result["usage"]["total_tokens"] == 15
    assert result["estimated_cost_usd"] is None
    assert result["history"][0]["estimated_cost_usd"] is None


@pytest.mark.parametrize(
    ("error", "code", "retryable"),
    [
        (ProviderError(401), "model_auth_failed", False),
        (ProviderError(403), "model_auth_failed", False),
        (ProviderError(404), "model_request_rejected", False),
        (ProviderError(429), "model_rate_limited", True),
        (ProviderError(500), "model_unavailable", True),
        (ProviderError(529), "model_unavailable", True),
        (TimeoutError(), "model_timeout", True),
        (ValueError("bug in engine code"), "internal_error", False),
    ],
)
def test_errors_are_classified_into_stable_codes(error, code, retryable):
    classified = classify_error(error, agent="writer")

    assert classified.code == code
    assert classified.retryable is retryable
    assert classified.agent == "writer"


def test_classification_keeps_engine_errors_and_redacts_messages():
    original = EngineError("agent_tool_limit", "Used all tool rounds")
    assert classify_error(original) is original

    leaked = classify_error(Exception("bad key sk-ant-api03-FAKEFAKEFAKEFAKE"))
    assert "sk-ant-api03-FAKEFAKEFAKEFAKE" not in leaked.message
