package com.example.demo.workflow;

import com.example.demo.agent.Agent;
import com.example.demo.agent.AgentNotFoundException;
import com.example.demo.agent.AgentRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class WorkflowService {

	private final WorkflowRepository workflowRepository;
	private final AgentRepository agentRepository;

	public WorkflowService(WorkflowRepository workflowRepository, AgentRepository agentRepository) {
		this.workflowRepository = workflowRepository;
		this.agentRepository = agentRepository;
	}

	public WorkflowResponse create(WorkflowRequest request) {
		String status = request.status() == null ? "ACTIVE" : request.status().toUpperCase();
		Set<Agent> agents = getAgents(request.agentIds());
		String entryAgent = request.entryAgent().trim();
		List<WorkflowEdge> edges = toEdges(request.edges());
		validateExecutionStructure(entryAgent, edges, agents);
		int maxHandoffs = request.maxHandoffs() == null ? 8 : request.maxHandoffs();
		Workflow workflow = new Workflow(request.name().trim(), request.description(), status, agents,
				entryAgent, edges, maxHandoffs);
		return WorkflowResponse.from(workflowRepository.save(workflow));
	}

	@Transactional(readOnly = true)
	public List<WorkflowResponse> findAll() {
		return workflowRepository.findAll().stream().map(WorkflowResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public WorkflowResponse findById(Long id) {
		return WorkflowResponse.from(getWorkflow(id));
	}

	public WorkflowResponse update(Long id, WorkflowRequest request) {
		Workflow workflow = getWorkflow(id);
		Set<Agent> agents = getAgents(request.agentIds());
		String entryAgent = request.entryAgent().trim();
		List<WorkflowEdge> edges = toEdges(request.edges());
		validateExecutionStructure(entryAgent, edges, agents);
		workflow.update(request.name().trim(), request.description(),
				request.status() == null ? null : request.status().toUpperCase(), agents, entryAgent, edges,
				request.maxHandoffs() == null ? 8 : request.maxHandoffs());
		return WorkflowResponse.from(workflowRepository.saveAndFlush(workflow));
	}

	public void delete(Long id) {
		workflowRepository.delete(getWorkflow(id));
	}

	private Workflow getWorkflow(Long id) {
		return workflowRepository.findById(id).orElseThrow(() -> new WorkflowNotFoundException(id));
	}

	private Set<Agent> getAgents(List<Long> agentIds) {
		Set<Long> requestedIds = new LinkedHashSet<>(agentIds);
		List<Agent> foundAgents = agentRepository.findAllById(requestedIds);
		Set<Long> foundIds = foundAgents.stream().map(Agent::getId).collect(java.util.stream.Collectors.toSet());
		requestedIds.stream().filter(id -> !foundIds.contains(id)).findFirst()
				.ifPresent(id -> { throw new AgentNotFoundException(id); });
		return new LinkedHashSet<>(foundAgents);
	}

	private List<WorkflowEdge> toEdges(List<WorkflowEdgeRequest> edges) {
		return edges.stream().map(edge -> new WorkflowEdge(edge.source().trim(), edge.target().trim())).toList();
	}

	private void validateExecutionStructure(String entryAgent, List<WorkflowEdge> edges, Set<Agent> agents) {
		Set<String> associatedNames = agents.stream().map(Agent::getName).collect(java.util.stream.Collectors.toSet());
		if (!associatedNames.contains(entryAgent)) {
			throw new WorkflowValidationException("entryAgent must name an agent associated with this workflow");
		}

		Set<String> edgeKeys = new java.util.HashSet<>();
		Map<String, Set<String>> adjacency = new HashMap<>();
		for (WorkflowEdge edge : edges) {
			if (!associatedNames.contains(edge.getSource()) || !associatedNames.contains(edge.getTarget())) {
				throw new WorkflowValidationException("Every edge source and target must name an agent associated with this workflow");
			}
			if (edge.getSource().equals(edge.getTarget())) {
				throw new WorkflowValidationException("A workflow edge cannot route an agent to itself");
			}
			if (!edgeKeys.add(edge.getSource() + "\u0000" + edge.getTarget())) {
				throw new WorkflowValidationException("Workflow edges must be unique");
			}
			adjacency.computeIfAbsent(edge.getSource(), key -> new java.util.HashSet<>()).add(edge.getTarget());
			adjacency.computeIfAbsent(edge.getTarget(), key -> new java.util.HashSet<>());
		}

		Set<String> reachable = new java.util.HashSet<>();
		reachable.add(entryAgent);
		List<String> pending = new java.util.ArrayList<>();
		pending.add(entryAgent);
		while (!pending.isEmpty()) {
			for (String target : adjacency.getOrDefault(pending.remove(pending.size() - 1), Set.of())) {
				if (reachable.add(target)) {
					pending.add(target);
				}
			}
		}
		if (!reachable.containsAll(associatedNames)) {
			throw new WorkflowValidationException("Every associated agent must be reachable from entryAgent");
		}
	}
}
