package com.example.demo.workflow.execution;

import com.example.demo.agent.Agent;
import com.example.demo.workflow.Workflow;
import com.example.demo.workflow.WorkflowEdge;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class WorkflowExecutionMapper {

	private static final Pattern ENGINE_NAME = Pattern.compile("^[a-z][a-z0-9_-]{1,63}$");

	public WorkflowExecutionContext map(Workflow workflow, String prompt) {
		validateText(prompt, 20_000, "prompt");
		if (!"ACTIVE".equalsIgnoreCase(workflow.getStatus())) {
			throw conflict("Workflow is inactive");
		}
		validateText(workflow.getName(), 120, "workflow name");
		String engineWorkflowName = toEngineWorkflowName(workflow.getName());
		String workflowDescription = descriptionOrName(workflow.getDescription(), workflow.getName());
		validateText(workflowDescription, 500, "workflow description");
		if (workflow.getMaxHandoffs() < 0 || workflow.getMaxHandoffs() > 32) {
			throw incompatible("maxHandoffs must be between 0 and 32");
		}

		List<Agent> agents = workflow.getAgents().stream()
				.sorted(java.util.Comparator.comparing(Agent::getName)).toList();
		if (agents.isEmpty() || agents.size() > 50) {
			throw incompatible("A runnable workflow must have between 1 and 50 associated agents");
		}

		Set<String> names = new HashSet<>();
		Set<String> models = new HashSet<>();
		List<EngineAgentRequest> engineAgents = new ArrayList<>();
		for (Agent agent : agents) {
			if (!"ACTIVE".equalsIgnoreCase(agent.getStatus())) {
				throw conflict("Agent '" + agent.getName() + "' is inactive");
			}
			validateName(agent.getName(), "agent name");
			if (!names.add(agent.getName())) {
				throw incompatible("Associated agents must have unique names");
			}
			String agentDescription = descriptionOrName(agent.getDescription(), agent.getName());
			validateText(agentDescription, 500, "agent description for " + agent.getName());
			validateText(agent.getSystemPrompt(), 12_000, "systemPrompt for " + agent.getName());
			validateText(agent.getModel(), 160, "model for " + agent.getName());
			models.add(agent.getModel());
			engineAgents.add(new EngineAgentRequest(agent.getName(), agentDescription, agent.getSystemPrompt()));
		}
		if (models.size() != 1) {
			throw incompatible("The engine uses one model per run; all associated agents must use the same model");
		}

		String entryAgent = workflow.getEntryAgent();
		if (entryAgent == null || !names.contains(entryAgent)) {
			throw incompatible("entryAgent must name an associated active agent");
		}
		List<WorkflowEdge> edges = workflow.getEdges();
		if (edges.size() > 100) {
			throw incompatible("The engine supports at most 100 workflow edges");
		}
		List<EngineEdgeRequest> engineEdges = new ArrayList<>();
		Set<String> edgeKeys = new HashSet<>();
		Map<String, Set<String>> adjacency = new HashMap<>();
		for (WorkflowEdge edge : edges) {
			if (!names.contains(edge.getSource()) || !names.contains(edge.getTarget())) {
				throw incompatible("Every workflow edge must reference associated active agents");
			}
			if (edge.getSource().equals(edge.getTarget())) {
				throw incompatible("A workflow edge cannot route an agent to itself");
			}
			if (!edgeKeys.add(edge.getSource() + "\u0000" + edge.getTarget())) {
				throw incompatible("Workflow edges must be unique");
			}
			adjacency.computeIfAbsent(edge.getSource(), key -> new HashSet<>()).add(edge.getTarget());
			adjacency.computeIfAbsent(edge.getTarget(), key -> new HashSet<>());
			engineEdges.add(new EngineEdgeRequest(edge.getSource(), edge.getTarget()));
		}
		validateReachability(entryAgent, adjacency);

		EngineWorkflowRequest engineWorkflow = new EngineWorkflowRequest(engineWorkflowName,
				workflowDescription, entryAgent, workflow.getMaxHandoffs(), engineEdges);
		return new WorkflowExecutionContext(workflow.getId(), workflow.getName(),
				new EngineRunRequest(prompt, engineWorkflow, engineAgents));
	}

	private void validateReachability(String entryAgent, Map<String, Set<String>> adjacency) {
		Set<String> visited = new HashSet<>();
		List<String> pending = new ArrayList<>();
		visited.add(entryAgent);
		pending.add(entryAgent);
		while (!pending.isEmpty()) {
			for (String target : adjacency.getOrDefault(pending.remove(pending.size() - 1), Set.of())) {
				if (visited.add(target)) {
					pending.add(target);
				}
			}
		}
		if (!visited.containsAll(adjacency.keySet())) {
			throw incompatible("Every workflow edge node must be reachable from entryAgent");
		}
	}

	private void validateName(String value, String field) {
		if (value == null || !ENGINE_NAME.matcher(value).matches()) {
			throw incompatible(field + " must match the Python engine format [a-z][a-z0-9_-]{1,63}");
		}
	}

	private void validateText(String value, int maxLength, String field) {
		if (value == null || value.isBlank() || value.length() > maxLength) {
			throw incompatible(field + " must contain 1 to " + maxLength + " characters");
		}
	}

	private String descriptionOrName(String description, String name) {
		return description == null || description.isBlank() ? name : description;
	}

	private String toEngineWorkflowName(String name) {
		String normalized = name.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9_-]+", "_");
		if (normalized.isEmpty() || normalized.charAt(0) < 'a' || normalized.charAt(0) > 'z') {
			normalized = "workflow_" + normalized;
		}
		if (normalized.length() == 1) {
			normalized += "_flow";
		}
		return normalized.length() > 64 ? normalized.substring(0, 64) : normalized;
	}

	private WorkflowExecutionRejectedException conflict(String message) {
		return new WorkflowExecutionRejectedException(HttpStatus.CONFLICT, message);
	}

	private WorkflowExecutionRejectedException incompatible(String message) {
		return new WorkflowExecutionRejectedException(HttpStatus.UNPROCESSABLE_CONTENT, message);
	}
}
