package com.example.demo.workflow.execution;

import org.springframework.http.HttpStatus;

public class WorkflowEngineFailureException extends RuntimeException {
	private final HttpStatus status;
	private final WorkflowRunResponse run;

	public WorkflowEngineFailureException(HttpStatus status, String message, WorkflowRunResponse run) {
		super(message);
		this.status = status;
		this.run = run;
	}

	public HttpStatus getStatus() { return status; }
	public WorkflowRunResponse getRun() { return run; }
}
