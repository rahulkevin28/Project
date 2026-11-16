package com.example.demo.workflow.execution;

public record WorkflowExecutionContext(Long workflowId, String workflowName, EngineRunRequest engineRequest) {
}
