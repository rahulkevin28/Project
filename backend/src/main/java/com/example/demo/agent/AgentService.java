package com.example.demo.agent;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AgentService {

	private final AgentRepository agentRepository;

	public AgentService(AgentRepository agentRepository) {
		this.agentRepository = agentRepository;
	}

	public AgentResponse create(AgentRequest request) {
		String status = request.status() == null ? "ACTIVE" : request.status().toUpperCase();
		Agent agent = new Agent(request.name().trim(), request.description(), request.agentType().trim(),
				request.model().trim(), request.systemPrompt(), status);
		return AgentResponse.from(agentRepository.save(agent));
	}

	@Transactional(readOnly = true)
	public List<AgentResponse> findAll() {
		return agentRepository.findAll().stream().map(AgentResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public AgentResponse findById(Long id) {
		return AgentResponse.from(getAgent(id));
	}

	public AgentResponse update(Long id, AgentRequest request) {
		Agent agent = getAgent(id);
		agent.update(request.name().trim(), request.description(), request.agentType().trim(),
				request.model().trim(), request.systemPrompt(), request.status() == null ? null : request.status().toUpperCase());
		return AgentResponse.from(agentRepository.saveAndFlush(agent));
	}

	public void delete(Long id) {
		agentRepository.delete(getAgent(id));
	}

	private Agent getAgent(Long id) {
		return agentRepository.findById(id).orElseThrow(() -> new AgentNotFoundException(id));
	}
}
