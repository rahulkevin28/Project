package com.example.demo.agent;

public class AgentNotFoundException extends RuntimeException {
	public AgentNotFoundException(Long id) {
		super("Agent with id " + id + " was not found");
	}
}
