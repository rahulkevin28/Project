package com.example.demo.workflow.execution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "workflow_runs")
public class WorkflowRun {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "workflow_id", nullable = false)
	private Long workflowId;

	@Column(name = "workflow_name", nullable = false, length = 120)
	private String workflowName;

	@Column(nullable = false, columnDefinition = "text")
	private String prompt;

	@Column(name = "engine_run_id", length = 80)
	private String engineRunId;

	@Column(nullable = false, length = 40)
	private String status;

	@Column(name = "engine_http_status")
	private Integer engineHttpStatus;

	@Column(name = "model", length = 160)
	private String model;

	@Column(name = "result_text", columnDefinition = "text")
	private String result;

	@Column(name = "started_at")
	private Instant startedAt;

	@Column(name = "finished_at")
	private Instant finishedAt;

	@Column(name = "duration_ms")
	private Long durationMs;

	@Column(name = "handoffs")
	private Integer handoffs;

	@Column(name = "estimated_cost_usd", precision = 16, scale = 8)
	private BigDecimal estimatedCostUsd;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "usage_data", columnDefinition = "jsonb")
	private Map<String, Object> usage;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "error_details", columnDefinition = "jsonb")
	private Map<String, Object> errorDetails;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "execution_history", columnDefinition = "jsonb")
	private List<Map<String, Object>> history;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "raw_response_json", columnDefinition = "jsonb")
	private Map<String, Object> rawResponseJson;

	@Column(name = "raw_response_text", columnDefinition = "text")
	private String rawResponseText;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected WorkflowRun() {
	}

	public WorkflowRun(Long workflowId, String workflowName, String prompt) {
		this.workflowId = workflowId;
		this.workflowName = workflowName;
		this.prompt = prompt;
		this.status = "RUNNING";
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
		if (startedAt == null) {
			startedAt = now;
		}
	}

	public void recordEngineResponse(int httpStatus, String rawText, Map<String, Object> rawJson,
			EngineRunResponse response) {
		engineHttpStatus = httpStatus;
		rawResponseText = rawText;
		rawResponseJson = rawJson;
		if (response != null) {
			engineRunId = response.runId();
			status = response.status() == null ? "ENGINE_ERROR" : response.status();
			model = response.model();
			result = response.result();
			handoffs = response.handoffs();
			startedAt = parseInstant(response.startedAt(), startedAt);
			finishedAt = parseInstant(response.finishedAt(), Instant.now());
			durationMs = response.durationMs();
			usage = response.usage();
			estimatedCostUsd = response.estimatedCostUsd();
			errorDetails = response.error();
			history = response.history();
		}
		if (errorDetails == null && rawJson != null && rawJson.containsKey("detail")) {
			errorDetails = Map.of("code", "engine_http_error", "message", String.valueOf(rawJson.get("detail")));
		}
		Instant now = Instant.now();
		if (httpStatus < 200 || httpStatus >= 300) {
			if (status == null || "RUNNING".equalsIgnoreCase(status)) {
				status = "FAILED";
			}
			if (errorDetails == null) {
				errorDetails = Map.of("code", "engine_http_error",
						"message", "The AI engine returned HTTP " + httpStatus);
			}
		}
		if (finishedAt == null || httpStatus < 200 || httpStatus >= 300) {
			finishedAt = now;
		}
		updatedAt = now;
	}

	public void recordProtocolFailure(int httpStatus, String rawText, Map<String, Object> rawJson,
			String message) {
		engineHttpStatus = httpStatus;
		rawResponseText = rawText;
		rawResponseJson = rawJson;
		status = "ENGINE_PROTOCOL_ERROR";
		finishedAt = Instant.now();
		errorDetails = Map.of("code", "invalid_engine_response", "message", message);
		updatedAt = Instant.now();
	}

	public void recordTransportFailure(String failureStatus, String message) {
		status = failureStatus;
		finishedAt = Instant.now();
		errorDetails = Map.of("code", failureStatus.toLowerCase(), "message", message);
		updatedAt = Instant.now();
	}

	private Instant parseInstant(String value, Instant fallback) {
		if (value == null || value.isBlank()) {
			return fallback;
		}
		try {
			return Instant.parse(value);
		} catch (RuntimeException ignored) {
			return fallback;
		}
	}

	public Long getId() { return id; }
	public Long getWorkflowId() { return workflowId; }
	public String getWorkflowName() { return workflowName; }
	public String getPrompt() { return prompt; }
	public String getEngineRunId() { return engineRunId; }
	public String getStatus() { return status; }
	public Integer getEngineHttpStatus() { return engineHttpStatus; }
	public String getModel() { return model; }
	public String getResult() { return result; }
	public Instant getStartedAt() { return startedAt; }
	public Instant getFinishedAt() { return finishedAt; }
	public Long getDurationMs() { return durationMs; }
	public Integer getHandoffs() { return handoffs; }
	public BigDecimal getEstimatedCostUsd() { return estimatedCostUsd; }
	public Map<String, Object> getUsage() { return usage; }
	public Map<String, Object> getErrorDetails() { return errorDetails; }
	public List<Map<String, Object>> getHistory() { return history; }
	public Map<String, Object> getRawResponseJson() { return rawResponseJson; }
	public String getRawResponseText() { return rawResponseText; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }
}
