package com.example.demo.workflow.execution;

import com.fasterxml.jackson.annotation.JsonProperty;

public record EngineEdgeRequest(String source, String target) {
}
