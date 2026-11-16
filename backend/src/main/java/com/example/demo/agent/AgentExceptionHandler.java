package com.example.demo.agent;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AgentController.class)
public class AgentExceptionHandler {
	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> handleDeleteConflict(DataIntegrityViolationException exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
				"timestamp", Instant.now(), "status", 409, "error", "Conflict",
				"message", "This agent is used by one or more workflows and cannot be deleted."));
	}

	@ExceptionHandler(AgentNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(AgentNotFoundException exception) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
				"timestamp", Instant.now(), "status", 404, "error", "Not Found", "message", exception.getMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
		Map<String, String> errors = exception.getBindingResult().getFieldErrors().stream()
				.collect(Collectors.toMap(error -> error.getField(), error -> error.getDefaultMessage(), (first, next) -> first));
		return ResponseEntity.badRequest().body(Map.of(
				"timestamp", Instant.now(), "status", 400, "error", "Bad Request", "details", errors));
	}
}
