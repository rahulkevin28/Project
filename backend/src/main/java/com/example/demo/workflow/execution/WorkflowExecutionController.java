package com.example.demo.workflow.execution;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowExecutionController {

	private final WorkflowExecutionService executionService;

	public WorkflowExecutionController(WorkflowExecutionService executionService) {
		this.executionService = executionService;
	}

	@PostMapping("/{workflowId}/runs")
	public ResponseEntity<WorkflowRunResponse> execute(@PathVariable Long workflowId,
			@Valid @RequestBody WorkflowExecutionRequest request) {
		return ResponseEntity.ok(executionService.execute(workflowId, request.prompt()));
	}
}
