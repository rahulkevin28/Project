package com.example.demo.workflow.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class WorkflowRunHistoryServiceTests {
	private final WorkflowRunRepository repository = mock(WorkflowRunRepository.class);
	private final WorkflowRunHistoryService historyService = new WorkflowRunHistoryService(repository);

	@Test
	void returnsPagedHistoryUsingTheExistingRunResponseFields() {
		WorkflowRun run = completedRun();
		Pageable requested = PageRequest.of(1, 2,
				Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
		when(repository.findAll(any(Pageable.class)))
				.thenReturn(new PageImpl<>(List.of(run), requested, 5));

		WorkflowRunPageResponse response = historyService.findAll(1, 2);

		assertEquals(1, response.page());
		assertEquals(2, response.size());
		assertEquals(5, response.totalElements());
		assertEquals(3, response.totalPages());
		assertEquals(1, response.content().size());
		WorkflowRunResponse item = response.content().getFirst();
		assertEquals("AI Analysis Workflow", item.workflowName());
		assertEquals("completed", item.status());
		assertEquals("gemini-2.5-flash", item.model());
		assertEquals("Workflow result", item.result());
		assertNotNull(item.startedAt());
		assertNotNull(item.finishedAt());
		assertEquals(1250L, item.durationMs());
		assertEquals("planner", item.history().getFirst().get("agent"));
		verify(repository).findAll(requested);
	}

	@Test
	void clampsPageAndSizeToSafeBounds() {
		Pageable[] captured = new Pageable[1];
		when(repository.findAll(any(Pageable.class))).thenAnswer(invocation -> {
			captured[0] = invocation.getArgument(0);
			return new PageImpl<>(List.of(), captured[0], 0);
		});

		historyService.findAll(-5, 1000);

		assertEquals(0, captured[0].getPageNumber());
		assertEquals(WorkflowRunHistoryService.MAX_SIZE, captured[0].getPageSize());
	}

	@Test
	void loadsOneRunByIdAndReportsMissingRuns() {
		WorkflowRun run = completedRun();
		when(repository.findById(7L)).thenReturn(Optional.of(run));
		when(repository.findById(99L)).thenReturn(Optional.empty());

		assertEquals("Workflow result", historyService.findById(7L).result());
		assertThrows(WorkflowRunNotFoundException.class, () -> historyService.findById(99L));
	}

	private WorkflowRun completedRun() {
		WorkflowRun run = new WorkflowRun(2L, "AI Analysis Workflow", "stored request");
		run.onCreate();
		EngineRunResponse engineResponse = new EngineRunResponse(
				"engine-run-7", "completed", "ai_analysis_workflow", "gemini-2.5-flash",
				"Workflow result", 1, "2026-11-15T08:00:00Z", "2026-11-15T08:00:01.250Z", 1250L,
				Map.of("total_tokens", 24), new BigDecimal("0.0003"), null,
				List.of(Map.of("agent", "planner", "status", "completed")), null);
		run.recordEngineResponse(200, "{}", Map.of("status", "completed"), engineResponse);
		return run;
	}
}
