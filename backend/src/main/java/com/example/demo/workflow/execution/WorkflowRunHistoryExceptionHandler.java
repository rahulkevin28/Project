package com.example.demo.workflow.execution;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = WorkflowRunHistoryController.class)
public class WorkflowRunHistoryExceptionHandler {
	@ExceptionHandler(WorkflowRunNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleRunNotFound(WorkflowRunNotFoundException exception) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
				"timestamp", Instant.now(), "status", 404, "error", "Not Found", "message", exception.getMessage()));
	}
}
