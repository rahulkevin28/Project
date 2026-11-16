package com.example.demo.workflow;

public class WorkflowNotFoundException extends RuntimeException {
	public WorkflowNotFoundException(Long id) {
		super("Workflow with id " + id + " was not found");
	}
}
