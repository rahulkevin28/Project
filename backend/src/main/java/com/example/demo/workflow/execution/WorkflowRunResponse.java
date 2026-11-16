package com.example.demo.workflow.execution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record WorkflowRunResponse(
		Long id,
		Long workflowId,
		String workflowName,
		String engineRunId,
		String status,
		Integer engineHttpStatus,
		String model,
		String result,
		Instant startedAt,
		Instant finishedAt,
		Long durationMs,
		Integer handoffs,
		Map<String, Object> usage,
		BigDecimal estimatedCostUsd,
		Map<String, Object> errorDetails,
		List<Map<String, Object>> history,
		Instant createdAt) {

	static WorkflowRunResponse from(WorkflowRun run) {
		return new WorkflowRunResponse(run.getId(), run.getWorkflowId(), run.getWorkflowName(),
				run.getEngineRunId(), run.getStatus(), run.getEngineHttpStatus(), run.getModel(), run.getResult(),
				run.getStartedAt(), run.getFinishedAt(), run.getDurationMs(), run.getHandoffs(), run.getUsage(),
				run.getEstimatedCostUsd(), run.getErrorDetails(), run.getHistory(), run.getCreatedAt());
	}
}
