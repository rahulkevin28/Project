package com.example.demo.agent;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AgentController.class)
@Import(AgentExceptionHandler.class)
@TestPropertySource(properties = {"app.admin.username=test-admin", "app.admin.password=test-password"})
class AgentDeletionConflictTests {
	@Autowired private MockMvc mockMvc;
	@MockitoBean private AgentService agentService;

	@Test
	@WithMockUser(username = "test-admin", roles = "ADMIN")
	void returnsConflictWhenAgentIsReferencedByWorkflow() throws Exception {
		doThrow(new DataIntegrityViolationException("foreign key violation")).when(agentService).delete(12L);
		mockMvc.perform(delete("/api/agents/12").with(csrf()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("This agent is used by one or more workflows and cannot be deleted."));
	}

	@Test
	@WithMockUser(username = "test-admin", roles = "ADMIN")
	void validAgentDeletionStillReturnsNoContent() throws Exception {
		doNothing().when(agentService).delete(12L);
		mockMvc.perform(delete("/api/agents/12").with(csrf())).andExpect(status().isNoContent());
	}
}
