package com.example.demo.workflow.execution;

import com.example.demo.workflow.Workflow;
import com.example.demo.workflow.WorkflowNotFoundException;
import com.example.demo.workflow.WorkflowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowExecutionLoader {

	private final WorkflowRepository workflowRepository;
	private final WorkflowExecutionMapper mapper;

	public WorkflowExecutionLoader(WorkflowRepository workflowRepository, WorkflowExecutionMapper mapper) {
		this.workflowRepository = workflowRepository;
		this.mapper = mapper;
	}

	@Transactional(readOnly = true)
	public WorkflowExecutionContext loadRequest(Long workflowId, String prompt) {
		Workflow workflow = workflowRepository.findForExecutionById(workflowId)
				.orElseThrow(() -> new WorkflowNotFoundException(workflowId));
		return mapper.map(workflow, prompt);
	}
}
