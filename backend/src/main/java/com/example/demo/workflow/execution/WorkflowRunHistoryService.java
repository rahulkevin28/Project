package com.example.demo.workflow.execution;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowRunHistoryService {
	static final int MAX_SIZE = 100;

	private final WorkflowRunRepository workflowRunRepository;

	public WorkflowRunHistoryService(WorkflowRunRepository workflowRunRepository) {
		this.workflowRunRepository = workflowRunRepository;
	}

	@Transactional(readOnly = true)
	public WorkflowRunPageResponse findAll(int page, int size) {
		int safePage = Math.max(page, 0);
		int safeSize = Math.min(Math.max(size, 1), MAX_SIZE);
		Sort sort = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
		Page<WorkflowRun> result = workflowRunRepository.findAll(PageRequest.of(safePage, safeSize, sort));
		List<WorkflowRunResponse> content = result.getContent().stream().map(WorkflowRunResponse::from).toList();
		return new WorkflowRunPageResponse(content, result.getNumber(), result.getSize(),
				result.getTotalElements(), result.getTotalPages());
	}

	@Transactional(readOnly = true)
	public WorkflowRunResponse findById(Long id) {
		WorkflowRun run = workflowRunRepository.findById(id).orElseThrow(() -> new WorkflowRunNotFoundException(id));
		return WorkflowRunResponse.from(run);
	}
}
