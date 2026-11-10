"""Specialised agent definitions and registry."""

from dataclasses import dataclass, field
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from .runtime import EngineError, ExecutionPolicy, StepTrace, call_model, call_tool
from .tools import ToolRegistry

GROUNDING_RULES = (
    "Grounding rules (these always apply and take priority over any conflicting instruction):\n"
    "- Treat the user's request, handoff notes from other agents, and approved tool results "
    "as the only sources of facts about the user's situation, policies, products, or data.\n"
    "- Never invent policy terms, conditions, exceptions, deadlines, fees, or other details "
    "that those sources do not state.\n"
    "- If something needed for the answer is not stated, say that it is not stated instead "
    "of guessing.\n"
    "- Label any assumption or general knowledge as such. Never present it as a confirmed "
    "fact or as part of a supplied policy."
)


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    description: str
    system_prompt: str
    tool_names: tuple[str, ...] = field(default_factory=tuple)
    max_tool_rounds: int = 5


def build_system_prompt(definition: AgentDefinition) -> str:
    """Combine an agent's own instructions with the engine-wide grounding rules."""
    return f"{definition.system_prompt.rstrip()}\n\n{GROUNDING_RULES}"


def message_text(content: Any) -> str:
    """Return the text of a model reply, including providers that send content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return str(content)


@dataclass(frozen=True)
class AgentResult:
    content: str
    handoff_to: str | None = None
    handoff_context: str | None = None


class HandoffInput(BaseModel):
    target_agent: str = Field(description="The registered specialist who should handle the next step")
    context: str = Field(description="A concise task and relevant findings for the receiving agent")


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AgentDefinition] = {}

    def register(self, agent: AgentDefinition) -> None:
        if agent.name in self._agents:
            raise ValueError(f"Agent {agent.name!r} is already registered")
        self._agents[agent.name] = agent

    def get(self, name: str) -> AgentDefinition:
        try:
            return self._agents[name]
        except KeyError as exc:
            raise KeyError(f"Unknown agent {name!r}") from exc

    def list(self) -> list[AgentDefinition]:
        return sorted(self._agents.values(), key=lambda item: item.name)

    def remove(self, name: str) -> AgentDefinition:
        try:
            return self._agents.pop(name)
        except KeyError as exc:
            raise KeyError(f"Unknown agent {name!r}") from exc

    def replace(self, agent: AgentDefinition) -> None:
        if agent.name not in self._agents:
            raise KeyError(f"Unknown agent {agent.name!r}")
        self._agents[agent.name] = agent

    async def invoke(self, name: str, prompt: str, model: BaseChatModel,
                     tools: ToolRegistry,
                     allowed_handoffs: tuple[str, ...] | None = None, *,
                     policy: ExecutionPolicy | None = None,
                     trace: StepTrace | None = None) -> AgentResult:
        """Run an agent, its approved tools, and optional typed agent handoff.

        Model calls use the policy's timeout and retries. Tool failures are returned to the
        model as error messages. Usage and tool activity are recorded on ``trace``.
        """
        policy = policy or ExecutionPolicy()
        trace = trace or StepTrace(agent=name)
        definition = self.get(name)
        agent_tools = tools.resolve(definition.tool_names)
        approved_tools = {tool.name: tool for tool in agent_tools}
        allowed_targets = sorted(allowed_handoffs if allowed_handoffs is not None
                                 else set(self._agents) - {name})

        def request_handoff(target_agent: str, context: str) -> str:
            """Routing is handled by the graph after the model returns this tool call."""
            return "Handoff requested"

        handoff_tool = StructuredTool.from_function(
            func=request_handoff,
            name="handoff_to_agent",
            description=("Delegate the next step to a registered specialist. "
                         f"Allowed targets: {', '.join(allowed_targets) or 'none'}"),
            args_schema=HandoffInput,
        )
        bound_model = model.bind_tools([*agent_tools, handoff_tool])
        messages: list[Any] = [SystemMessage(content=build_system_prompt(definition)),
                               HumanMessage(content=prompt)]
        for _ in range(definition.max_tool_rounds + 1):
            response = await call_model(bound_model, messages, policy, trace)
            messages.append(response)
            calls = getattr(response, "tool_calls", []) or []
            if not calls:
                return AgentResult(content=message_text(response.content))

            handoffs = [call for call in calls if call["name"] == handoff_tool.name]
            if handoffs and len(calls) > 1:
                # Every tool call needs a reply, so reject them all and let the model try again.
                for call in calls:
                    messages.append(ToolMessage(
                        content="Request a handoff on its own, without other tool calls in the "
                                "same reply.",
                        tool_call_id=call["id"], status="error",
                    ))
                    trace.record_tool(call["name"], "rejected",
                                      error="Handoff was mixed with other tool calls")
                continue
            if handoffs:
                request = handoffs[0]
                target = request.get("args", {}).get("target_agent", "")
                if target not in allowed_targets:
                    messages.append(ToolMessage(
                        content=f"Unknown handoff target {target!r}. Choose a registered target.",
                        tool_call_id=request["id"],
                    ))
                    continue
                context = str(request.get("args", {}).get("context") or "").strip()
                return AgentResult(
                    content=message_text(response.content), handoff_to=target,
                    handoff_context=context or None,
                )

            for call in calls:
                tool = approved_tools.get(call["name"])
                if tool is None:
                    messages.append(ToolMessage(
                        content=(f"Tool {call['name']!r} is not approved for this agent. "
                                 f"Approved tools: {', '.join(sorted(approved_tools)) or 'none'}."),
                        tool_call_id=call["id"], status="error",
                    ))
                    trace.record_tool(call["name"], "rejected",
                                      error="Not approved for this agent")
                    continue
                content, status = await call_tool(tool, call.get("args", {}), policy, trace)
                messages.append(ToolMessage(content=content, tool_call_id=call["id"],
                                            status=status))
        raise EngineError(
            "agent_tool_limit",
            f"Agent {name!r} used all {definition.max_tool_rounds} tool rounds without answering.",
            agent=name,
        )
