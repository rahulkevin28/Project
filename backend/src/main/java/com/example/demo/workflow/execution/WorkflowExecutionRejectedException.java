package com.example.demo.workflow.execution;

import org.springframework.http.HttpStatus;

public class WorkflowExecutionRejectedException extends RuntimeException {
	private final HttpStatus status;

	public WorkflowExecutionRejectedException(HttpStatus status, String message) {
		super(message);
		this.status = status;
	}

	public HttpStatus getStatus() { return status; }
}
