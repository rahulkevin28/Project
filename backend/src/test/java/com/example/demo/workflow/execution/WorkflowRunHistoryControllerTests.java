package com.example.demo.workflow.execution;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class WorkflowRunHistoryControllerTests {
	private final WorkflowRunHistoryService historyService = mock(WorkflowRunHistoryService.class);
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new WorkflowRunHistoryController(historyService))
				.setControllerAdvice(new WorkflowRunHistoryExceptionHandler())
				.build();
	}

	@Test
	void listEndpointReturnsThePagedHistoryEnvelope() throws Exception {
		when(historyService.findAll(0, 20)).thenReturn(new WorkflowRunPageResponse(List.of(), 0, 20, 0, 0));

		mockMvc.perform(get("/api/workflow-runs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content").isArray())
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(20))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void missingRunEndpointReturnsNotFound() throws Exception {
		when(historyService.findById(404L)).thenThrow(new WorkflowRunNotFoundException(404L));

		mockMvc.perform(get("/api/workflow-runs/404"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("Workflow run with id 404 was not found"));
	}
}
