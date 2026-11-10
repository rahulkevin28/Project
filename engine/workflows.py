"""Workflow metadata and registry."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class WorkflowDefinition:
    name: str
    description: str
    entry_agent: str
    max_handoffs: int = 8
    edges: tuple[tuple[str, str], ...] = field(default_factory=tuple)

    def targets_for(self, agent_name: str) -> tuple[str, ...]:
        """Return the configured destinations available to this agent."""
        return tuple(target for source, target in self.edges if source == agent_name)


class WorkflowRegistry:
    def __init__(self) -> None:
        self._workflows: dict[str, WorkflowDefinition] = {}

    def register(self, workflow: WorkflowDefinition) -> None:
        if workflow.name in self._workflows:
            raise ValueError(f"Workflow {workflow.name!r} is already registered")
        self._workflows[workflow.name] = workflow

    def get(self, name: str) -> WorkflowDefinition:
        try:
            return self._workflows[name]
        except KeyError as exc:
            raise KeyError(f"Unknown workflow {name!r}") from exc

    def list(self) -> list[WorkflowDefinition]:
        return sorted(self._workflows.values(), key=lambda item: item.name)

    def remove(self, name: str) -> WorkflowDefinition:
        try:
            return self._workflows.pop(name)
        except KeyError as exc:
            raise KeyError(f"Unknown workflow {name!r}") from exc

    def replace(self, workflow: WorkflowDefinition) -> None:
        if workflow.name not in self._workflows:
            raise KeyError(f"Unknown workflow {workflow.name!r}")
        self._workflows[workflow.name] = workflow
