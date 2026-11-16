package com.example.demo.workflow.execution;

import com.fasterxml.jackson.annotation.JsonProperty;

public record EngineAgentRequest(
		String name,
		String description,
		@JsonProperty("system_prompt") String systemPrompt) {
}
