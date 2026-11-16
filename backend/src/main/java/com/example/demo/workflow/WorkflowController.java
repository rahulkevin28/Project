package com.example.demo.workflow;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {

	private final WorkflowService workflowService;

	public WorkflowController(WorkflowService workflowService) {
		this.workflowService = workflowService;
	}

	@PostMapping
	public ResponseEntity<WorkflowResponse> create(@Valid @RequestBody WorkflowRequest request) {
		WorkflowResponse created = workflowService.create(request);
		return ResponseEntity.created(URI.create("/api/workflows/" + created.id())).body(created);
	}

	@GetMapping
	public List<WorkflowResponse> findAll() {
		return workflowService.findAll();
	}

	@GetMapping("/{id}")
	public WorkflowResponse findById(@PathVariable Long id) {
		return workflowService.findById(id);
	}

	@PutMapping("/{id}")
	public WorkflowResponse update(@PathVariable Long id, @Valid @RequestBody WorkflowRequest request) {
		return workflowService.update(id, request);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		workflowService.delete(id);
		return ResponseEntity.noContent().build();
	}
}
