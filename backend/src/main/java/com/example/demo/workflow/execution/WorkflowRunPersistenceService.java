package com.example.demo.workflow.execution;

import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowRunPersistenceService {

	private final WorkflowRunRepository workflowRunRepository;

	public WorkflowRunPersistenceService(WorkflowRunRepository workflowRunRepository) {
		this.workflowRunRepository = workflowRunRepository;
	}

	@Transactional
	public WorkflowRunResponse start(Long workflowId, String workflowName, String prompt) {
		WorkflowRun run = workflowRunRepository.saveAndFlush(new WorkflowRun(workflowId, workflowName, prompt));
		return WorkflowRunResponse.from(run);
	}

	@Transactional
	public WorkflowRunResponse recordEngineResponse(Long runId, EngineHttpResponse response) {
		WorkflowRun run = workflowRunRepository.findById(runId).orElseThrow();
		run.recordEngineResponse(response.statusCode(), response.rawBody(), response.body(), response.run());
		return WorkflowRunResponse.from(workflowRunRepository.saveAndFlush(run));
	}

	@Transactional
	public WorkflowRunResponse recordTransportFailure(Long runId, String status, String message) {
		WorkflowRun run = workflowRunRepository.findById(runId).orElseThrow();
		run.recordTransportFailure(status, message);
		return WorkflowRunResponse.from(workflowRunRepository.saveAndFlush(run));
	}

	@Transactional
	public WorkflowRunResponse recordProtocolFailure(Long runId, EngineHttpResponse response, String message) {
		WorkflowRun run = workflowRunRepository.findById(runId).orElseThrow();
		run.recordProtocolFailure(response.statusCode(), response.rawBody(), response.body(), message);
		return WorkflowRunResponse.from(workflowRunRepository.saveAndFlush(run));
	}
}
