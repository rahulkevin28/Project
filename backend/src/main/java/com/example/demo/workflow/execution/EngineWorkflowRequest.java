package com.example.demo.workflow.execution;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record EngineWorkflowRequest(
		String name,
		String description,
		@JsonProperty("entry_agent") String entryAgent,
		@JsonProperty("max_handoffs") int maxHandoffs,
		List<EngineEdgeRequest> edges) {
}
