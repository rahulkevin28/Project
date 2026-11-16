package com.example.demo.workflow.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.net.http.HttpTimeoutException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class WorkflowExecutionServiceTests {

	private final WorkflowExecutionLoader loader = mock(WorkflowExecutionLoader.class);
	private final PythonEngineClient engineClient = mock(PythonEngineClient.class);
	private final WorkflowRunPersistenceService persistence = mock(WorkflowRunPersistenceService.class);
	private final EngineRunRequest request = new EngineRunRequest("do work",
			new EngineWorkflowRequest("support", "Support", "planner", 8, List.of()), List.of());
	private final WorkflowExecutionContext context = new WorkflowExecutionContext(9L, "support", request);
	private final WorkflowRunResponse running = runResponse(11L, "RUNNING", 202);
	private final WorkflowExecutionService service = new WorkflowExecutionService(loader, engineClient, persistence);

	@BeforeEach
	void setUp() {
		when(loader.loadRequest(9L, "do work")).thenReturn(context);
		when(persistence.start(9L, "support", "do work")).thenReturn(running);
	}

	@Test
	void successfulExecutionIsPersistedAndReturned() {
		EngineRunResponse engineRun = engineRun("completed", null);
		EngineHttpResponse httpResponse = response(200, engineRun, Map.of("run_id", "engine-1", "status", "completed"));
		WorkflowRunResponse completed = runResponse(11L, "completed", 200);
		when(engineClient.execute(request)).thenReturn(httpResponse);
		when(persistence.recordEngineResponse(11L, httpResponse)).thenReturn(completed);

		assertSame(completed, service.execute(9L, "do work"));
		verify(persistence).start(9L, "support", "do work");
		verify(persistence).recordEngineResponse(11L, httpResponse);
	}

	@Test
	void engineFailureBodyIsPersistedAndReturnedWithGatewayStatus() {
		Map<String, Object> error = Map.of("code", "model_unavailable", "message", "provider unavailable");
		EngineRunResponse engineRun = engineRun("failed", error);
		EngineHttpResponse httpResponse = response(502, engineRun,
				Map.of("run_id", "engine-1", "status", "failed", "error", error));
		WorkflowRunResponse failed = runResponse(11L, "failed", 502);
		when(engineClient.execute(request)).thenReturn(httpResponse);
		when(persistence.recordEngineResponse(11L, httpResponse)).thenReturn(failed);

		WorkflowEngineFailureException exception = assertThrows(WorkflowEngineFailureException.class,
				() -> service.execute(9L, "do work"));
		assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatus());
		assertSame(failed, exception.getRun());
		verify(persistence).recordEngineResponse(11L, httpResponse);
	}

	@Test
	void timeoutIsPersistedWithoutRetry() {
		WorkflowRunResponse failed = runResponse(11L, "TIMED_OUT", null);
		when(engineClient.execute(request)).thenThrow(new PythonEngineTimeoutException(new HttpTimeoutException("timeout")));
		when(persistence.recordTransportFailure(11L, "TIMED_OUT",
				"The AI engine did not respond before the configured timeout")).thenReturn(failed);

		WorkflowEngineFailureException exception = assertThrows(WorkflowEngineFailureException.class,
				() -> service.execute(9L, "do work"));
		assertEquals(HttpStatus.GATEWAY_TIMEOUT, exception.getStatus());
		verify(engineClient).execute(request);
		verify(persistence).recordTransportFailure(11L, "TIMED_OUT",
				"The AI engine did not respond before the configured timeout");
	}

	@Test
	void connectionFailureIsPersistedWithoutRetry() {
		WorkflowRunResponse failed = runResponse(11L, "ENGINE_UNAVAILABLE", null);
		when(engineClient.execute(request)).thenThrow(new PythonEngineUnavailableException(new java.io.IOException("refused")));
		when(persistence.recordTransportFailure(11L, "ENGINE_UNAVAILABLE",
				"The AI engine could not be reached")).thenReturn(failed);

		WorkflowEngineFailureException exception = assertThrows(WorkflowEngineFailureException.class,
				() -> service.execute(9L, "do work"));
		assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatus());
		verify(engineClient).execute(request);
		verify(persistence).recordTransportFailure(11L, "ENGINE_UNAVAILABLE",
				"The AI engine could not be reached");
	}

	private static EngineHttpResponse response(int status, EngineRunResponse run, Map<String, Object> body) {
		return new EngineHttpResponse(status, "{\"status\":\"" + run.status() + "\"}", body, run);
	}

	private static EngineRunResponse engineRun(String status, Map<String, Object> error) {
		return new EngineRunResponse("engine-1", status, "support", "gpt-4o-mini", "answer", 1,
				"2026-11-12T10:00:00Z", "2026-11-12T10:00:01Z", 100L,
				Map.of("total_tokens", 10), new BigDecimal("0.001"), error,
				List.of(Map.of("agent", "planner", "status", status)), null);
	}

	private static WorkflowRunResponse runResponse(Long id, String status, Integer httpStatus) {
		return new WorkflowRunResponse(id, 9L, "support", "engine-1", status, httpStatus,
				"gpt-4o-mini", "answer", Instant.parse("2026-11-12T10:00:00Z"),
				Instant.parse("2026-11-12T10:00:01Z"), 100L, 1, Map.of("total_tokens", 10),
				new BigDecimal("0.001"), null, List.of(), Instant.parse("2026-11-12T10:00:00Z"));
	}
}
