package com.example.demo.workflow.execution;

import java.util.List;

public record EngineRunRequest(String prompt, EngineWorkflowRequest workflow,
		List<EngineAgentRequest> agents) {
}
