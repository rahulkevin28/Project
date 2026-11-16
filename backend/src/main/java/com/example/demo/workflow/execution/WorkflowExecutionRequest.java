package com.example.demo.workflow.execution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkflowExecutionRequest(@NotBlank @Size(max = 20_000) String prompt) {
}
