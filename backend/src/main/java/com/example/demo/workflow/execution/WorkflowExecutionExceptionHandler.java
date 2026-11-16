package com.example.demo.workflow.execution;

import com.example.demo.workflow.WorkflowNotFoundException;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = WorkflowExecutionController.class)
public class WorkflowExecutionExceptionHandler {

	@ExceptionHandler(WorkflowNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleWorkflowNotFound(WorkflowNotFoundException exception) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
				"timestamp", Instant.now(), "status", 404, "error", "Not Found", "message", exception.getMessage()));
	}

	@ExceptionHandler(WorkflowExecutionRejectedException.class)
	public ResponseEntity<Map<String, Object>> handleRejected(WorkflowExecutionRejectedException exception) {
		return ResponseEntity.status(exception.getStatus()).body(Map.of(
				"timestamp", Instant.now(), "status", exception.getStatus().value(),
				"error", exception.getStatus().getReasonPhrase(), "message", exception.getMessage()));
	}

	@ExceptionHandler(WorkflowEngineFailureException.class)
	public ResponseEntity<WorkflowEngineFailureBody> handleEngineFailure(WorkflowEngineFailureException exception) {
		return ResponseEntity.status(exception.getStatus())
				.body(new WorkflowEngineFailureBody(exception.getMessage(), exception.getRun()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
		Map<String, String> errors = exception.getBindingResult().getFieldErrors().stream()
				.collect(Collectors.toMap(error -> error.getField(), error -> error.getDefaultMessage(), (first, next) -> first));
		return ResponseEntity.badRequest().body(Map.of(
				"timestamp", Instant.now(), "status", 400, "error", "Bad Request", "details", errors));
	}

	public record WorkflowEngineFailureBody(String message, WorkflowRunResponse run) {
	}
}
