"""Explicit allow-list for tools exposed to agents."""

from langchain_core.tools import BaseTool


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"Tool {tool.name!r} is already registered")
        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseTool:
        try:
            return self._tools[name]
        except KeyError as exc:
            raise KeyError(f"Unknown tool {name!r}") from exc

    def resolve(self, names: tuple[str, ...] | list[str]) -> list[BaseTool]:
        return [self.get(name) for name in names]

    def names(self) -> list[str]:
        return sorted(self._tools)
