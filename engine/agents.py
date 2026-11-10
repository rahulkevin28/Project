"""Specialised agent definitions and registry."""

from dataclasses import dataclass, field
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from .tools import ToolRegistry


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    description: str
    system_prompt: str
    tool_names: tuple[str, ...] = field(default_factory=tuple)
    max_tool_rounds: int = 5


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

    async def invoke(self, name: str, prompt: str, model: BaseChatModel,
                     tools: ToolRegistry) -> str:
        """Run a model/tool loop for one specialised agent."""
        definition = self.get(name)
        agent_tools = tools.resolve(definition.tool_names)
        bound_model = model.bind_tools(agent_tools) if agent_tools else model
        messages: list[Any] = [SystemMessage(content=definition.system_prompt),
                               HumanMessage(content=prompt)]
        for _ in range(definition.max_tool_rounds + 1):
            response = await bound_model.ainvoke(messages)
            messages.append(response)
            calls = getattr(response, "tool_calls", []) or []
            if not calls:
                return str(response.content)
            for call in calls:
                tool = tools.get(call["name"])
                result = await tool.ainvoke(call.get("args", {}))
                from langchain_core.messages import ToolMessage

                messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
        raise RuntimeError(f"Agent {name!r} exceeded {definition.max_tool_rounds} tool rounds")
