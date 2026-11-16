package com.example.demo.workflow.execution;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workflow-runs")
public class WorkflowRunHistoryController {
	private final WorkflowRunHistoryService historyService;

	public WorkflowRunHistoryController(WorkflowRunHistoryService historyService) {
		this.historyService = historyService;
	}

	@GetMapping
	public WorkflowRunPageResponse findAll(
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		return historyService.findAll(page, size);
	}

	@GetMapping("/{id}")
	public WorkflowRunResponse findById(@PathVariable Long id) {
		return historyService.findById(id);
	}
}
