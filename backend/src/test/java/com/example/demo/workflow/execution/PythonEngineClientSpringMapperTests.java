package com.example.demo.workflow.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import tools.jackson.databind.ObjectMapper;

@JsonTest
class PythonEngineClientSpringMapperTests {

	@Autowired
	private ObjectMapper springObjectMapper;

	@Test
	void springManagedMapperSendsTheRunAsAJsonBody() throws Exception {
		AtomicReference<String> contentType = new AtomicReference<>();
		AtomicReference<String> receivedBody = new AtomicReference<>();
		HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/runs", exchange -> capture(exchange, contentType, receivedBody));
		server.start();
		try {
			int port = server.getAddress().getPort();
			EngineProperties properties = new EngineProperties(URI.create("http://127.0.0.1:" + port), "",
					Duration.ofSeconds(1), Duration.ofSeconds(2));
			HttpClient client = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
			PythonEngineClient engineClient = new PythonEngineClient(client, springObjectMapper, properties);
			engineClient.execute(new EngineRunRequest("body probe",
					new EngineWorkflowRequest("analysis_flow", "analysis_flow", "analysis_agent", 8, List.of()),
					List.of(new EngineAgentRequest("analysis_agent", "analysis_agent", "safe test prompt"))));

			assertEquals("application/json", contentType.get());
			assertTrue(receivedBody.get() != null && receivedBody.get().startsWith("{"));
			assertTrue(receivedBody.get().contains("\"prompt\":\"body probe\""));
			assertTrue(receivedBody.get().contains("\"workflow\":{"));
			assertTrue(receivedBody.get().contains("\"agents\":["));
			assertTrue(receivedBody.get().contains("\"entry_agent\":\"analysis_agent\""));
			assertTrue(receivedBody.get().contains("\"system_prompt\":\"safe test prompt\""));
		} finally {
			server.stop(0);
		}
	}

	private static void capture(HttpExchange exchange, AtomicReference<String> contentType,
			AtomicReference<String> receivedBody) throws IOException {
		contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
		receivedBody.set(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
		byte[] response = "{\"run_id\":\"capture-1\",\"status\":\"completed\"}"
				.getBytes(java.nio.charset.StandardCharsets.UTF_8);
		exchange.getResponseHeaders().set("Content-Type", "application/json");
		exchange.sendResponseHeaders(200, response.length);
		exchange.getResponseBody().write(response);
		exchange.close();
	}
}
