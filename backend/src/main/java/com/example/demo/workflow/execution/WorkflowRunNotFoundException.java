package com.example.demo.workflow.execution;

public class WorkflowRunNotFoundException extends RuntimeException {
	public WorkflowRunNotFoundException(Long id) {
		super("Workflow run with id " + id + " was not found");
	}
}
