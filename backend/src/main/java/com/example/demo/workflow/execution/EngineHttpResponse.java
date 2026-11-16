package com.example.demo.workflow.execution;

import java.util.Map;

public record EngineHttpResponse(int statusCode, String rawBody, Map<String, Object> body,
		EngineRunResponse run) {
}
