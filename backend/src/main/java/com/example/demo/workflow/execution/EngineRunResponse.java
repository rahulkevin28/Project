package com.example.demo.workflow.execution;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record EngineRunResponse(
		@JsonProperty("run_id") String runId,
		String status,
		String workflow,
		String model,
		String result,
		Integer handoffs,
		@JsonProperty("started_at") String startedAt,
		@JsonProperty("finished_at") String finishedAt,
		@JsonProperty("duration_ms") Long durationMs,
		Map<String, Object> usage,
		@JsonProperty("estimated_cost_usd") BigDecimal estimatedCostUsd,
		Map<String, Object> error,
		List<Map<String, Object>> history,
		String detail) {
}
