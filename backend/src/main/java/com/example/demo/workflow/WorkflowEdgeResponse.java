package com.example.demo.workflow;

public record WorkflowEdgeResponse(String source, String target) {
	static WorkflowEdgeResponse from(WorkflowEdge edge) {
		return new WorkflowEdgeResponse(edge.getSource(), edge.getTarget());
	}
}
