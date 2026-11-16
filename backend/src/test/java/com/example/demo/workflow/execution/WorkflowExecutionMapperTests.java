package com.example.demo.workflow.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.demo.agent.Agent;
import com.example.demo.workflow.Workflow;
import com.example.demo.workflow.WorkflowEdge;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class WorkflowExecutionMapperTests {

	private final WorkflowExecutionMapper mapper = new WorkflowExecutionMapper();

	@Test
	void mapsDefinitionsToPythonSchemaWithoutJavaOnlyFields() throws Exception {
		Agent planner = agent("planner", "Plans", "plan carefully");
		Agent writer = agent("writer", "Writes", "write clearly");
		Workflow workflow = new Workflow("support", "Support workflow", "ACTIVE", Set.of(planner, writer),
				"planner", List.of(new WorkflowEdge("planner", "writer")), 6);

		WorkflowExecutionContext context = mapper.map(workflow, "Handle this request");
		String json = new ObjectMapper().writeValueAsString(context.engineRequest());

		assertEquals("Handle this request", context.engineRequest().prompt());
		assertEquals("planner", context.engineRequest().workflow().entryAgent());
		assertEquals(6, context.engineRequest().workflow().maxHandoffs());
		assertEquals(List.of(new EngineEdgeRequest("planner", "writer")), context.engineRequest().workflow().edges());
		assertTrue(json.contains("\"entry_agent\":\"planner\""));
		assertTrue(json.contains("\"max_handoffs\":6"));
		assertTrue(json.contains("\"system_prompt\""));
		assertTrue(!json.contains("agentType") && !json.contains("agentIds") && !json.contains("\"model\""));
	}

	@Test
	void rejectsInactiveWorkflowsAndAgents() {
		Workflow inactiveWorkflow = new Workflow("support", "Support workflow", "INACTIVE",
				Set.of(agent("planner", "Plans", "prompt")), "planner", List.of(), 8);
		assertThrows(WorkflowExecutionRejectedException.class, () -> mapper.map(inactiveWorkflow, "prompt"));

		Workflow activeWorkflowWithInactiveAgent = new Workflow("support", "Support workflow", "ACTIVE",
				Set.of(agent("planner", "Plans", "prompt", "INACTIVE")), "planner", List.of(), 8);
		assertThrows(WorkflowExecutionRejectedException.class,
				() -> mapper.map(activeWorkflowWithInactiveAgent, "prompt"));
	}

	@Test
	void rejectsLegacyWorkflowWithoutEntryAgentAsNonExecutable() {
		Workflow legacyWorkflow = new Workflow("support", "Support workflow", "ACTIVE",
				Set.of(agent("planner", "Plans", "prompt")), null, List.of(), 8);

		assertThrows(WorkflowExecutionRejectedException.class,
				() -> mapper.map(legacyWorkflow, "prompt"));
	}

	@Test
	void normalizesDisplayWorkflowNamesToEngineIdentifiers() {
		Workflow displayNamed = new Workflow("AI Analysis Workflow", "Support workflow", "ACTIVE",
				Set.of(agent("planner", "Plans", "prompt")), "planner", List.of(), 8);

		WorkflowExecutionContext context = mapper.map(displayNamed, "prompt");

		assertEquals("ai_analysis_workflow", context.engineRequest().workflow().name());
	}

	@Test
	void suppliesNameFallbacksForOptionalDescriptionsRequiredByEngine() {
		Agent agent = agent("analysis_agent", null, "Analyze carefully");
		Workflow workflow = new Workflow("analysis_flow", null, "ACTIVE", Set.of(agent),
				"analysis_agent", List.of(), 8);

		WorkflowExecutionContext context = mapper.map(workflow, "Analyze this");

		assertEquals("analysis_flow", context.engineRequest().workflow().description());
		assertEquals("analysis_agent", context.engineRequest().agents().getFirst().description());
	}

	private static Agent agent(String name, String description, String systemPrompt) {
		return agent(name, description, systemPrompt, "ACTIVE");
	}

	private static Agent agent(String name, String description, String systemPrompt, String status) {
		Agent agent = mock(Agent.class);
		when(agent.getName()).thenReturn(name);
		when(agent.getDescription()).thenReturn(description);
		when(agent.getSystemPrompt()).thenReturn(systemPrompt);
		when(agent.getStatus()).thenReturn(status);
		when(agent.getModel()).thenReturn("gpt-4o-mini");
		return agent;
	}
}
