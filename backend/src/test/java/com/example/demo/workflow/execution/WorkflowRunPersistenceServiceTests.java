package com.example.demo.workflow.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class WorkflowRunPersistenceServiceTests {

	private final WorkflowRunRepository repository = mock(WorkflowRunRepository.class);
	private final WorkflowRunPersistenceService persistence = new WorkflowRunPersistenceService(repository);

	@Test
	void storesPromptAndEngineRunMetadataHistoryAndRawResponse() {
		when(repository.saveAndFlush(any(WorkflowRun.class))).thenAnswer(invocation -> invocation.getArgument(0));
		persistence.start(17L, "support", "customer prompt");

		ArgumentCaptor<WorkflowRun> startedCaptor = ArgumentCaptor.forClass(WorkflowRun.class);
		verify(repository).saveAndFlush(startedCaptor.capture());
		WorkflowRun run = startedCaptor.getValue();
		assertEquals(17L, run.getWorkflowId());
		assertEquals("support", run.getWorkflowName());
		assertEquals("customer prompt", run.getPrompt());
		assertEquals("RUNNING", run.getStatus());

		when(repository.findById(1L)).thenReturn(Optional.of(run));
		EngineRunResponse engineRun = new EngineRunResponse("engine-17", "completed", "support",
				"gpt-4o-mini", "answer", 2, "2026-11-12T10:00:00Z", "2026-11-12T10:00:02Z", 200L,
				Map.of("total_tokens", 12), new BigDecimal("0.002"), null,
				List.of(Map.of("agent", "planner", "status", "completed")), null);
		Map<String, Object> json = Map.of("run_id", "engine-17", "status", "completed");
		EngineHttpResponse engineResponse = new EngineHttpResponse(200,
				"{\"run_id\":\"engine-17\",\"status\":\"completed\"}", json, engineRun);

		WorkflowRunResponse response = persistence.recordEngineResponse(1L, engineResponse);

		assertEquals("engine-17", response.engineRunId());
		assertEquals("completed", response.status());
		assertEquals("answer", response.result());
		assertEquals(2, response.handoffs());
		assertEquals(12, response.usage().get("total_tokens"));
		assertEquals("completed", response.history().getFirst().get("status"));
		assertEquals(json, run.getRawResponseJson());
		assertEquals(engineResponse.rawBody(), run.getRawResponseText());
		verify(repository, org.mockito.Mockito.times(2)).saveAndFlush(any(WorkflowRun.class));
	}

	@Test
	void unsuccessfulEngineResponsePersistsTerminalFailureStatus() {
		when(repository.saveAndFlush(any(WorkflowRun.class))).thenAnswer(invocation -> invocation.getArgument(0));
		WorkflowRun run = new WorkflowRun(2L, "AI Analysis Workflow", "prompt");
		when(repository.findById(1L)).thenReturn(Optional.of(run));
		EngineHttpResponse engineResponse = new EngineHttpResponse(422,
				"{\"detail\":\"request body missing\"}",
				Map.of("detail", "request body missing"), null);

		WorkflowRunResponse persisted = persistence.recordEngineResponse(1L, engineResponse);

		assertEquals("FAILED", persisted.status());
		assertEquals(422, persisted.engineHttpStatus());
		assertNotNull(persisted.finishedAt());
		assertEquals("request body missing", persisted.errorDetails().get("message"));
	}

	@Test
	void transportTimeoutPersistsTerminalStatus() {
		when(repository.saveAndFlush(any(WorkflowRun.class))).thenAnswer(invocation -> invocation.getArgument(0));
		WorkflowRun run = new WorkflowRun(2L, "AI Analysis Workflow", "prompt");
		when(repository.findById(1L)).thenReturn(Optional.of(run));

		WorkflowRunResponse persisted = persistence.recordTransportFailure(1L, "TIMED_OUT", "timeout");

		assertEquals("TIMED_OUT", persisted.status());
		assertNotNull(persisted.finishedAt());
	}
}
