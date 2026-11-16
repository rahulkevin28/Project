package com.example.demo.workflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkflowEdgeRequest(
		@NotBlank @Size(max = 120) String source,
		@NotBlank @Size(max = 120) String target) {
}
