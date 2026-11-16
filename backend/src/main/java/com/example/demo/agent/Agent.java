package com.example.demo.agent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "agents")
public class Agent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(length = 2000)
	private String description;

	@Column(name = "agent_type", nullable = false, length = 80)
	private String agentType;

	@Column(nullable = false, length = 160)
	private String model;

	@Column(name = "system_prompt", nullable = false, columnDefinition = "text")
	private String systemPrompt;

	@Column(nullable = false, length = 30)
	private String status;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Agent() {
	}

	public Agent(String name, String description, String agentType, String model, String systemPrompt, String status) {
		this.name = name;
		this.description = description;
		this.agentType = agentType;
		this.model = model;
		this.systemPrompt = systemPrompt;
		this.status = status;
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public Long getId() { return id; }
	public String getName() { return name; }
	public String getDescription() { return description; }
	public String getAgentType() { return agentType; }
	public String getModel() { return model; }
	public String getSystemPrompt() { return systemPrompt; }
	public String getStatus() { return status; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }

	public void update(String name, String description, String agentType, String model, String systemPrompt, String status) {
		this.name = name;
		this.description = description;
		this.agentType = agentType;
		this.model = model;
		this.systemPrompt = systemPrompt;
		if (status != null) {
			this.status = status;
		}
	}
}
