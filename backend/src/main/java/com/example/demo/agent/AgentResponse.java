package com.example.demo.agent;

import java.time.Instant;

public record AgentResponse(
		Long id,
		String name,
		String description,
		String agentType,
		String model,
		String systemPrompt,
		String status,
		Instant createdAt,
		Instant updatedAt) {

	static AgentResponse from(Agent agent) {
		return new AgentResponse(agent.getId(), agent.getName(), agent.getDescription(), agent.getAgentType(),
				agent.getModel(), agent.getSystemPrompt(), agent.getStatus(), agent.getCreatedAt(), agent.getUpdatedAt());
	}
}
