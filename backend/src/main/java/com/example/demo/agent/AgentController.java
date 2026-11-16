package com.example.demo.agent;

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
@RequestMapping("/api/agents")
public class AgentController {

	private final AgentService agentService;

	public AgentController(AgentService agentService) {
		this.agentService = agentService;
	}

	@PostMapping
	public ResponseEntity<AgentResponse> create(@Valid @RequestBody AgentRequest request) {
		AgentResponse created = agentService.create(request);
		return ResponseEntity.created(URI.create("/api/agents/" + created.id())).body(created);
	}

	@GetMapping
	public List<AgentResponse> findAll() {
		return agentService.findAll();
	}

	@GetMapping("/{id}")
	public AgentResponse findById(@PathVariable Long id) {
		return agentService.findById(id);
	}

	@PutMapping("/{id}")
	public AgentResponse update(@PathVariable Long id, @Valid @RequestBody AgentRequest request) {
		return agentService.update(id, request);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable Long id) {
		agentService.delete(id);
		return ResponseEntity.noContent().build();
	}
}
