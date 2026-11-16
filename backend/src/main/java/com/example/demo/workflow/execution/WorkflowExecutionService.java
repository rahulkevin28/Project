package com.example.demo.workflow.execution;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class WorkflowExecutionService {

	private final WorkflowExecutionLoader loader;
	private final PythonEngineClient engineClient;
	private final WorkflowRunPersistenceService runPersistence;

	public WorkflowExecutionService(WorkflowExecutionLoader loader, PythonEngineClient engineClient,
			WorkflowRunPersistenceService runPersistence) {
		this.loader = loader;
		this.engineClient = engineClient;
		this.runPersistence = runPersistence;
	}

	public WorkflowRunResponse execute(Long workflowId, String prompt) {
		WorkflowExecutionContext context = loader.loadRequest(workflowId, prompt);
		WorkflowRunResponse running = runPersistence.start(context.workflowId(), context.workflowName(), prompt);

		EngineHttpResponse engineResponse;
		try {
			engineResponse = engineClient.execute(context.engineRequest());
		} catch (PythonEngineTimeoutException exception) {
			WorkflowRunResponse failed = runPersistence.recordTransportFailure(running.id(), "TIMED_OUT",
					exception.getMessage());
			throw new WorkflowEngineFailureException(HttpStatus.GATEWAY_TIMEOUT, exception.getMessage(), failed);
		} catch (PythonEngineUnavailableException exception) {
			WorkflowRunResponse failed = runPersistence.recordTransportFailure(running.id(), "ENGINE_UNAVAILABLE",
					exception.getMessage());
			throw new WorkflowEngineFailureException(HttpStatus.SERVICE_UNAVAILABLE, exception.getMessage(), failed);
		} catch (PythonEngineException exception) {
			WorkflowRunResponse failed = runPersistence.recordTransportFailure(running.id(), "ENGINE_REQUEST_ERROR",
					exception.getMessage());
			throw new WorkflowEngineFailureException(HttpStatus.BAD_GATEWAY, exception.getMessage(), failed);
		} catch (RuntimeException exception) {
			String message = "An unexpected error occurred while communicating with the AI engine";
			WorkflowRunResponse failed = runPersistence.recordTransportFailure(running.id(), "ENGINE_ERROR", message);
			throw new WorkflowEngineFailureException(HttpStatus.BAD_GATEWAY, message, failed);
		}

		WorkflowRunResponse persisted = runPersistence.recordEngineResponse(running.id(), engineResponse);
		EngineRunResponse result = engineResponse.run();
		if (engineResponse.statusCode() < 200 || engineResponse.statusCode() >= 300) {
			throw engineFailure(engineResponse, persisted);
		}
		if (result == null || result.runId() == null || result.status() == null) {
			persisted = runPersistence.recordProtocolFailure(running.id(), engineResponse,
					"The engine returned a successful HTTP status without a valid run record");
			throw new WorkflowEngineFailureException(HttpStatus.BAD_GATEWAY,
					"The AI engine returned an invalid response", persisted);
		}
		if ("failed".equalsIgnoreCase(result.status()) || result.error() != null) {
			throw engineFailure(engineResponse, persisted);
		}
		return persisted;
	}

	private WorkflowEngineFailureException engineFailure(EngineHttpResponse response, WorkflowRunResponse run) {
		int statusCode = response.statusCode();
		HttpStatus status = statusCode == 503 ? HttpStatus.SERVICE_UNAVAILABLE
				: statusCode == 504 ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY;
		String message = errorMessage(response.body());
		return new WorkflowEngineFailureException(status, message, run);
	}

	private String errorMessage(Map<String, Object> body) {
		if (body == null) {
			return "The AI engine returned an error response";
		}
		Object detail = body.get("detail");
		if (detail != null) {
			return String.valueOf(detail);
		}
		Object error = body.get("error");
		if (error instanceof Map<?, ?> errorFields && errorFields.get("message") != null) {
			return String.valueOf(errorFields.get("message"));
		}
		return "The AI engine reported a failed workflow execution";
	}
}
