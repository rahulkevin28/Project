package com.example.demo.workflow.execution;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class PythonEngineClient {

	private final HttpClient httpClient;
	private final ObjectMapper objectMapper;
	private final EngineProperties properties;

	public PythonEngineClient(HttpClient pythonEngineHttpClient, ObjectMapper objectMapper,
			EngineProperties properties) {
		this.httpClient = pythonEngineHttpClient;
		this.objectMapper = objectMapper;
		this.properties = properties;
	}

	public EngineHttpResponse execute(EngineRunRequest payload) {
		String body;
		try {
			body = objectMapper.writeValueAsString(payload);
		} catch (Exception exception) {
			throw new PythonEngineException("Could not encode the AI engine request", exception);
		}
		HttpRequest.Builder request = HttpRequest.newBuilder(runsUri())
				.timeout(properties.responseTimeout())
				.header("Content-Type", "application/json")
				.header("Accept", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(body));
		if (properties.apiToken() != null && !properties.apiToken().isBlank()) {
			request.header("Authorization", "Bearer " + properties.apiToken());
		}

		HttpResponse<String> response;
		try {
			response = httpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
		} catch (java.net.http.HttpTimeoutException exception) {
			throw new PythonEngineTimeoutException(exception);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new PythonEngineUnavailableException(exception);
		} catch (IOException exception) {
			throw new PythonEngineUnavailableException(exception);
		}

		Map<String, Object> jsonBody = parseBody(response.body());
		EngineRunResponse run = null;
		if (jsonBody != null) {
			try {
				run = objectMapper.convertValue(jsonBody, EngineRunResponse.class);
			} catch (RuntimeException ignored) {
				// Keep the raw JSON for diagnosis if the engine response shape changes.
			}
		}
		return new EngineHttpResponse(response.statusCode(), response.body(), jsonBody, run);
	}

	private URI runsUri() {
		String base = properties.baseUrl().toString();
		if (!base.endsWith("/")) {
			base += "/";
		}
		return URI.create(base).resolve("runs");
	}

	private Map<String, Object> parseBody(String body) {
		if (body == null || body.isBlank()) {
			return null;
		}
		try {
			return objectMapper.readValue(body, new TypeReference<>() { });
		} catch (Exception ignored) {
			return null;
		}
	}
}
