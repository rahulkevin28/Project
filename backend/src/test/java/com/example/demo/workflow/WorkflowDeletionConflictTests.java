package com.example.demo.workflow;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
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

@WebMvcTest(WorkflowController.class)
@Import(WorkflowExceptionHandler.class)
@TestPropertySource(properties = {"app.admin.username=test-admin", "app.admin.password=test-password"})
class WorkflowDeletionConflictTests {
	@Autowired private MockMvc mockMvc;
	@MockitoBean private WorkflowService workflowService;

	@Test
	@WithMockUser(username = "test-admin", roles = "ADMIN")
	void returnsConflictWhenWorkflowDeletionIsBlockedByReferences() throws Exception {
		doThrow(new DataIntegrityViolationException("foreign key violation")).when(workflowService).delete(9L);
		mockMvc.perform(delete("/api/workflows/9").with(csrf()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("This workflow is still referenced by other records and cannot be deleted."));
	}

	@Test
	@WithMockUser(username = "test-admin", roles = "ADMIN")
	void validWorkflowDeletionStillReturnsNoContent() throws Exception {
		doNothing().when(workflowService).delete(9L);
		mockMvc.perform(delete("/api/workflows/9").with(csrf())).andExpect(status().isNoContent());
	}
}
