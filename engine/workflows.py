"""Workflow metadata and registry."""

from dataclasses import dataclass


@dataclass(frozen=True)
class WorkflowDefinition:
    name: str
    description: str
    entry_agent: str
    max_handoffs: int = 8


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
