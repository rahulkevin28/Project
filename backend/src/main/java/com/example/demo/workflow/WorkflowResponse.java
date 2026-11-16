package com.example.demo.workflow;

import java.time.Instant;
import java.util.List;

public record WorkflowResponse(
		Long id,
		String name,
		String description,
		String status,
		List<Long> agentIds,
		String entryAgent,
		List<WorkflowEdgeResponse> edges,
		int maxHandoffs,
		Instant createdAt,
		Instant updatedAt) {

	static WorkflowResponse from(Workflow workflow) {
		List<Long> agentIds = workflow.getAgents().stream().map(agent -> agent.getId()).sorted().toList();
		List<WorkflowEdgeResponse> edges = workflow.getEdges().stream().map(WorkflowEdgeResponse::from).toList();
		return new WorkflowResponse(workflow.getId(), workflow.getName(), workflow.getDescription(),
				workflow.getStatus(), agentIds, workflow.getEntryAgent(), edges, workflow.getMaxHandoffs(),
				workflow.getCreatedAt(), workflow.getUpdatedAt());
	}
}
