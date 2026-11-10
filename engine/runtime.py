"""Run-time support: limits, retries, error codes, redaction, and per-step traces."""

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_REDACTIONS = (
    # OpenAI (sk-..., sk-proj-...) and Anthropic (sk-ant-...) keys.
    (re.compile(r"sk-[A-Za-z0-9_-]{8,}"), "[REDACTED_API_KEY]"),
    # Google API keys.
    (re.compile(r"AIza[0-9A-Za-z_-]{20,}"), "[REDACTED_API_KEY]"),
    (re.compile(r"(?i)bearer\s+\S+"), "Bearer [REDACTED]"),
    # Environment-style assignments such as GOOGLE_API_KEY=... or api_key: ...
    (re.compile(r"(?i)\b([a-z0-9_]*api_key)\s*[=:]\s*[^\s,;)]+"), r"\1=[REDACTED]"),
    # Header-style keys such as x-api-key or x-goog-api-key.
    (re.compile(r"(?i)(x-(?:goog-)?api-key[\"']?\s*[:=]\s*[\"']?)[^\s,;\"']+"), r"\1[REDACTED]"),
    # Query-string keys used by some REST endpoints (?key=...).
    (re.compile(r"(?i)([?&]key=)[^&\s]+"), r"\1[REDACTED]"),
)


def redact(value: object, limit: int = 1000) -> str:
    """Remove common credential formats from text before it is logged or returned."""
    message = str(value)
    for pattern, replacement in _REDACTIONS:
        message = pattern.sub(replacement, message)
    return message[:limit]


@dataclass(frozen=True)
class ExecutionPolicy:
    """Limits applied to every run. All values are seconds except the retry count."""

    model_timeout_seconds: float = 60.0
    model_max_retries: int = 2
    retry_backoff_seconds: float = 1.0
    tool_timeout_seconds: float = 30.0
    run_timeout_seconds: float = 300.0


class ModelPrice(BaseModel):
    """Prices in US dollars per million tokens, used only for cost estimates."""

    input_per_million: float = Field(ge=0)
    output_per_million: float = Field(ge=0)

    def cost(self, input_tokens: int, output_tokens: int) -> float:
        total = input_tokens * self.input_per_million + output_tokens * self.output_per_million
        return round(total / 1_000_000, 6)


# Error codes returned in run records, with the HTTP status the API uses for each.
HTTP_STATUS_BY_CODE = {
    "model_timeout": 504,
    "run_timeout": 504,
    "model_rate_limited": 503,
    "model_unavailable": 502,
    "model_auth_failed": 502,
    "model_request_rejected": 502,
    "model_error": 502,
    "agent_tool_limit": 502,
    "internal_error": 500,
}

_PROVIDER_MODULES = {"openai", "anthropic", "google", "httpx", "httpcore", "langchain_core",
                     "langchain_openai", "langchain_anthropic", "langchain_google_genai", "grpc"}


class EngineError(Exception):
    """A run failure with a stable code that callers can act on."""

    def __init__(self, code: str, message: str, *, retryable: bool = False,
                 agent: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.agent = agent

    @property
    def http_status(self) -> int:
        return HTTP_STATUS_BY_CODE.get(self.code, 500)

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "retryable": self.retryable,
                "agent": self.agent}


def _status_code(exc: BaseException) -> int | None:
    for source in (exc, getattr(exc, "response", None)):
        for attr in ("status_code", "code"):
            value = getattr(source, attr, None)
            if isinstance(value, int) and not isinstance(value, bool) and 100 <= value <= 599:
                return value
    return None


def classify_error(exc: BaseException, agent: str | None = None) -> EngineError:
    """Map provider and engine exceptions to an EngineError without importing provider SDKs."""
    if isinstance(exc, EngineError):
        if agent and not exc.agent:
            exc.agent = agent
        return exc
    message = redact(exc, 300) or type(exc).__name__
    name = type(exc).__name__.lower()
    status = _status_code(exc)
    if isinstance(exc, TimeoutError) or "timeout" in name:
        return EngineError("model_timeout", message, retryable=True, agent=agent)
    if status == 429 or "ratelimit" in name:
        return EngineError("model_rate_limited", message, retryable=True, agent=agent)
    if status in (401, 403) or "authentication" in name or "permissiondenied" in name:
        return EngineError("model_auth_failed", message, agent=agent)
    if (status is not None and status >= 500) or "connection" in name or "overloaded" in name:
        return EngineError("model_unavailable", message, retryable=True, agent=agent)
    if status is not None and 400 <= status < 500:
        return EngineError("model_request_rejected", message, agent=agent)
    if type(exc).__module__.split(".")[0] in _PROVIDER_MODULES:
        return EngineError("model_error", message, agent=agent)
    return EngineError("internal_error", message, agent=agent)


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ms_since(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)


@dataclass
class StepTrace:
    """What one agent did during a run, for monitoring, logs, and cost tracking."""

    agent: str
    started_at: str = field(default_factory=utc_now)
    status: str = "running"
    result: str = ""
    handoff_to: str | None = None
    handoff_context: str | None = None
    model_calls: int = 0
    retries: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: int | None = None
    error: dict[str, Any] | None = None
    clock: float = field(default_factory=time.perf_counter, repr=False)

    def record_model_reply(self, message: Any) -> None:
        self.model_calls += 1
        usage = getattr(message, "usage_metadata", None) or {}
        self.input_tokens += int(usage.get("input_tokens") or 0)
        self.output_tokens += int(usage.get("output_tokens") or 0)

    def record_tool(self, name: str, status: str, started: float | None = None,
                    error: str | None = None) -> None:
        entry: dict[str, Any] = {"name": name, "status": status,
                                 "duration_ms": ms_since(started) if started else 0}
        if error:
            entry["error"] = error
        self.tool_calls.append(entry)

    def finish(self, status: str, error: dict[str, Any] | None = None) -> None:
        if self.duration_ms is None:
            self.duration_ms = ms_since(self.clock)
        self.status = status
        self.error = error

    def as_dict(self, price: ModelPrice | None = None) -> dict[str, Any]:
        return {
            "agent": self.agent, "status": self.status, "result": self.result,
            "handoff_to": self.handoff_to, "handoff_context": self.handoff_context,
            "started_at": self.started_at, "duration_ms": self.duration_ms,
            "model_calls": self.model_calls, "retries": self.retries,
            "usage": {"input_tokens": self.input_tokens, "output_tokens": self.output_tokens,
                      "total_tokens": self.input_tokens + self.output_tokens},
            "estimated_cost_usd": price.cost(self.input_tokens, self.output_tokens) if price else None,
            "tool_calls": list(self.tool_calls), "error": self.error,
        }


async def call_model(bound_model: Any, messages: list[Any], policy: ExecutionPolicy,
                     trace: StepTrace) -> Any:
    """Call the model with a timeout, retrying only errors that are safe to retry."""
    attempt = 0
    while True:
        try:
            reply = await asyncio.wait_for(bound_model.ainvoke(messages),
                                           timeout=policy.model_timeout_seconds)
        except TimeoutError as exc:
            error = EngineError(
                "model_timeout",
                f"The model did not reply within {policy.model_timeout_seconds:g} seconds.",
                retryable=True, agent=trace.agent)
            cause: BaseException = exc
        except Exception as exc:  # noqa: BLE001 - every failure is classified and re-raised
            error, cause = classify_error(exc, trace.agent), exc
        else:
            trace.record_model_reply(reply)
            return reply
        if not error.retryable or attempt >= policy.model_max_retries:
            raise error from cause
        attempt += 1
        trace.retries += 1
        logger.warning("Retrying %s model call after %s (retry %d of %d)", trace.agent,
                       error.code, attempt, policy.model_max_retries)
        await asyncio.sleep(policy.retry_backoff_seconds * 2 ** (attempt - 1))


async def call_tool(tool: Any, args: dict[str, Any], policy: ExecutionPolicy,
                    trace: StepTrace) -> tuple[str, str]:
    """Run a tool with a timeout. Failures are returned as text so the agent can recover."""
    started = time.perf_counter()
    try:
        result = await asyncio.wait_for(tool.ainvoke(args), timeout=policy.tool_timeout_seconds)
    except TimeoutError:
        message = f"Tool {tool.name!r} did not finish within {policy.tool_timeout_seconds:g} seconds."
    except Exception as exc:  # noqa: BLE001 - tool failures go back to the model as text
        message = f"Tool {tool.name!r} failed: {redact(exc, 300)}"
    else:
        trace.record_tool(tool.name, "ok", started)
        return str(result), "success"
    trace.record_tool(tool.name, "error", started, message)
    return message, "error"
