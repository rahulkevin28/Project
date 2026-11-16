package com.example.demo.agent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AgentRequest(
		@NotBlank @Size(max = 120) String name,
		@Size(max = 2000) String description,
		@NotBlank @Size(max = 80) String agentType,
		@NotBlank @Size(max = 160) String model,
		@NotBlank String systemPrompt,
		@Pattern(regexp = "(?i)ACTIVE|INACTIVE", message = "status must be ACTIVE or INACTIVE") String status) {
}
