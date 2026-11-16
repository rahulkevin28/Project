package com.example.demo.workflow;

import com.example.demo.agent.Agent;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "workflows")
public class Workflow {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(length = 2000)
	private String description;

	@Column(nullable = false, length = 30)
	private String status;

	@Column(name = "entry_agent", length = 120)
	private String entryAgent;

	@Column(name = "max_handoffs", nullable = false)
	private int maxHandoffs = 8;

	@ManyToMany
	@JoinTable(name = "workflow_agents",
			joinColumns = @JoinColumn(name = "workflow_id"),
			inverseJoinColumns = @JoinColumn(name = "agent_id"))
	@OrderBy("id ASC")
	private Set<Agent> agents = new LinkedHashSet<>();

	@ElementCollection
	@CollectionTable(name = "workflow_edges", joinColumns = @JoinColumn(name = "workflow_id"))
	@OrderColumn(name = "edge_order")
	private List<WorkflowEdge> edges = new ArrayList<>();

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected Workflow() {
	}

	public Workflow(String name, String description, String status, Set<Agent> agents,
			String entryAgent, List<WorkflowEdge> edges, int maxHandoffs) {
		this.name = name;
		this.description = description;
		this.status = status;
		this.agents.addAll(agents);
		this.entryAgent = entryAgent;
		this.edges.addAll(edges);
		this.maxHandoffs = maxHandoffs;
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
	public String getStatus() { return status; }
	public Set<Agent> getAgents() { return agents; }
	public String getEntryAgent() { return entryAgent; }
	public List<WorkflowEdge> getEdges() { return edges; }
	public int getMaxHandoffs() { return maxHandoffs; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }

	public void update(String name, String description, String status, Set<Agent> agents,
			String entryAgent, List<WorkflowEdge> edges, int maxHandoffs) {
		this.name = name;
		this.description = description;
		if (status != null) {
			this.status = status;
		}
		this.agents.clear();
		this.agents.addAll(agents);
		this.entryAgent = entryAgent;
		this.edges.clear();
		this.edges.addAll(edges);
		this.maxHandoffs = maxHandoffs;
	}
}
