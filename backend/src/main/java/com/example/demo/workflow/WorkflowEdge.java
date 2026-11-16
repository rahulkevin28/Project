package com.example.demo.workflow;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class WorkflowEdge {

	@Column(name = "source_agent", nullable = false, length = 120)
	private String source;

	@Column(name = "target_agent", nullable = false, length = 120)
	private String target;

	protected WorkflowEdge() {
	}

	public WorkflowEdge(String source, String target) {
		this.source = source;
		this.target = target;
	}

	public String getSource() { return source; }
	public String getTarget() { return target; }
}
