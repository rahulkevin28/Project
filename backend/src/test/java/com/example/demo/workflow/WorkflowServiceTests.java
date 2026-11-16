package com.example.demo.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.demo.agent.Agent;
import com.example.demo.agent.AgentRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class WorkflowServiceTests {

	private final WorkflowRepository workflowRepository = mock(WorkflowRepository.class);
	private final AgentRepository agentRepository = mock(AgentRepository.class);
	private final Agent planner = agent(1L, "planner");
	private final Agent writer = agent(2L, "writer");
	private final Agent researcher = agent(3L, "researcher");
	private WorkflowService workflowService;

	@BeforeEach
	void setUp() {
		workflowService = new WorkflowService(workflowRepository, agentRepository);
		when(agentRepository.findAllById(anyIterable())).thenAnswer(invocation -> {
			Iterable<Long> requestedIds = invocation.getArgument(0);
			Set<Long> requested = new HashSet<>();
			requestedIds.forEach(requested::add);
			return List.of(planner, writer, researcher).stream()
					.filter(agent -> requested.contains(agent.getId())).toList();
		});
		when(workflowRepository.save(any(Workflow.class))).thenAnswer(invocation -> invocation.getArgument(0));
		when(workflowRepository.saveAndFlush(any(Workflow.class))).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void createsWorkflowWithAssociatedEntryAgentAndEdges() {
		WorkflowResponse response = workflowService.create(request(
				List.of(1L, 2L), "planner", List.of(edge("planner", "writer")), 4));

		assertEquals("planner", response.entryAgent());
		assertEquals(List.of(1L, 2L), response.agentIds());
		assertEquals(List.of(new WorkflowEdgeResponse("planner", "writer")), response.edges());
		assertEquals(4, response.maxHandoffs());

		ArgumentCaptor<Workflow> saved = ArgumentCaptor.forClass(Workflow.class);
		verify(workflowRepository).save(saved.capture());
		assertEquals(Set.of(planner, writer), saved.getValue().getAgents());
	}

	@Test
	void rejectsEntryAgentNotAssociatedWithWorkflow() {
		assertInvalid(request(List.of(1L), "writer", List.of(), 8));
	}

	@Test
	void rejectsEdgesReferencingAgentsNotAssociatedWithWorkflow() {
		assertInvalid(request(List.of(1L, 2L), "planner", List.of(edge("planner", "researcher")), 8));
	}

	@Test
	void rejectsSelfEdges() {
		assertInvalid(request(List.of(1L), "planner", List.of(edge("planner", "planner")), 8));
	}

	@Test
	void rejectsDuplicateEdges() {
		assertInvalid(request(List.of(1L, 2L), "planner",
				List.of(edge("planner", "writer"), edge("planner", "writer")), 8));
	}

	@Test
	void rejectsUnreachableNodesInEdgeGraph() {
		assertInvalid(request(List.of(1L, 2L, 3L), "planner",
				List.of(edge("planner", "writer"), edge("researcher", "writer")), 8));
	}

	@Test
	void defaultsMaxHandoffsToEightWhenOmitted() {
		WorkflowResponse response = workflowService.create(
				request(List.of(1L), "planner", List.of(), null));

		assertEquals(8, response.maxHandoffs());
	}

	@Test
	void rejectsAssociatedAgentWithoutEdgesAsUnreachable() {
		assertInvalid(request(List.of(1L, 2L), "planner", List.of(), 8));
	}

	@Test
	void acceptsValidSingleAgentWorkflowWithoutEdges() {
		WorkflowResponse response = workflowService.create(request(List.of(1L), "planner", List.of(), 8));
		assertEquals(List.of(1L), response.agentIds());
		assertEquals("planner", response.entryAgent());
	}

	@Test
	void preservesCrudAndAgentAssociations() {
		WorkflowResponse created = workflowService.create(
				request(List.of(1L, 2L), "planner", List.of(edge("planner", "writer")), 4));
		Workflow workflow = captureSavedWorkflow();
		when(workflowRepository.findById(42L)).thenReturn(Optional.of(workflow));
		when(workflowRepository.findAll()).thenReturn(List.of(workflow));

		assertEquals(List.of(1L, 2L), created.agentIds());			// create
		assertEquals(1, workflowService.findAll().size());			// list
		assertEquals("planner", workflowService.findById(42L).entryAgent()); // get by ID

		WorkflowResponse updated = workflowService.update(42L,
				request(List.of(2L, 3L), "writer", List.of(edge("writer", "researcher")), 6));
		assertEquals(List.of(2L, 3L), updated.agentIds());
		assertEquals("writer", updated.entryAgent());
		assertEquals(List.of(new WorkflowEdgeResponse("writer", "researcher")), updated.edges());
		assertEquals("ACTIVE", updated.status());

		workflowService.delete(42L);
		verify(workflowRepository).delete(workflow);
	}

	private void assertInvalid(WorkflowRequest request) {
		assertThrows(WorkflowValidationException.class, () -> workflowService.create(request));
		verify(workflowRepository, never()).save(any(Workflow.class));
	}

	private Workflow captureSavedWorkflow() {
		ArgumentCaptor<Workflow> saved = ArgumentCaptor.forClass(Workflow.class);
		verify(workflowRepository).save(saved.capture());
		return saved.getValue();
	}

	private static WorkflowRequest request(List<Long> agentIds, String entryAgent,
			List<WorkflowEdgeRequest> edges, Integer maxHandoffs) {
		return new WorkflowRequest("support", "Support workflow", null, agentIds,
				entryAgent, edges, maxHandoffs);
	}

	private static WorkflowEdgeRequest edge(String source, String target) {
		return new WorkflowEdgeRequest(source, target);
	}

	private static Agent agent(Long id, String name) {
		Agent agent = mock(Agent.class);
		when(agent.getId()).thenReturn(id);
		when(agent.getName()).thenReturn(name);
		return agent;
	}
}
