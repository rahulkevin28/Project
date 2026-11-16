package com.example.demo.workflow.execution;

import java.util.List;

public record WorkflowRunPageResponse(
		List<WorkflowRunResponse> content,
		int page,
		int size,
		long totalElements,
		int totalPages) {
}
