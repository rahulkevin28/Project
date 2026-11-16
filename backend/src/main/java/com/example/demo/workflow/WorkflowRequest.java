package com.example.demo.workflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import java.util.List;

public record WorkflowRequest(
		@NotBlank @Size(max = 120) String name,
		@Size(max = 2000) String description,
		@Pattern(regexp = "(?i)ACTIVE|INACTIVE", message = "status must be ACTIVE or INACTIVE") String status,
		@NotNull List<@NotNull @Positive Long> agentIds,
		@NotBlank @Size(max = 120) String entryAgent,
		List<@NotNull @Valid WorkflowEdgeRequest> edges,
		@Min(0) @Max(32) Integer maxHandoffs) {

	public WorkflowRequest {
		if (edges == null) {
			edges = List.of();
		}
	}
}
