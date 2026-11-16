package com.example.demo.workflow;

import com.example.demo.agent.AgentNotFoundException;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = WorkflowController.class)
public class WorkflowExceptionHandler {
	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> handleDeleteConflict(DataIntegrityViolationException exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
				"timestamp", Instant.now(), "status", 409, "error", "Conflict",
				"message", "This workflow is still referenced by other records and cannot be deleted."));
	}

	@ExceptionHandler(WorkflowNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleWorkflowNotFound(WorkflowNotFoundException exception) {
		return notFound(exception.getMessage());
	}

	@ExceptionHandler(AgentNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleAgentNotFound(AgentNotFoundException exception) {
		return notFound(exception.getMessage());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
		Map<String, String> errors = exception.getBindingResult().getFieldErrors().stream()
				.collect(Collectors.toMap(error -> error.getField(), error -> error.getDefaultMessage(), (first, next) -> first));
		return ResponseEntity.badRequest().body(Map.of(
				"timestamp", Instant.now(), "status", 400, "error", "Bad Request", "details", errors));
	}

	@ExceptionHandler(WorkflowValidationException.class)
	public ResponseEntity<Map<String, Object>> handleWorkflowValidation(WorkflowValidationException exception) {
		return ResponseEntity.badRequest().body(Map.of(
				"timestamp", Instant.now(), "status", 400, "error", "Bad Request", "message", exception.getMessage()));
	}

	private ResponseEntity<Map<String, Object>> notFound(String message) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
				"timestamp", Instant.now(), "status", 404, "error", "Not Found", "message", message));
	}
}
