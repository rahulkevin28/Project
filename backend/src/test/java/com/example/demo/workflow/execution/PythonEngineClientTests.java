package com.example.demo.workflow.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class PythonEngineClientTests {

	@Test
	void sendsJsonAndBearerTokenAndParsesRunResponse() throws Exception {
		AtomicReference<String> authorization = new AtomicReference<>();
		AtomicReference<String> body = new AtomicReference<>();
		AtomicReference<String> contentType = new AtomicReference<>();
		AtomicReference<String> method = new AtomicReference<>();
		HttpServer server = server(exchange -> {
			authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
			contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
			method.set(exchange.getRequestMethod());
			body.set(new String(exchange.getRequestBody().readAllBytes()));
			respond(exchange, 200, "{\"run_id\":\"run-1\",\"status\":\"completed\",\"result\":\"done\"}");
		});
		server.start();
		try {
			PythonEngineClient client = client(server.getAddress().getPort(), "shared-secret", Duration.ofSeconds(2));
			EngineHttpResponse response = client.execute(request());

			assertEquals("Bearer shared-secret", authorization.get());
			assertEquals(200, response.statusCode());
			assertEquals("run-1", response.run().runId());
			assertEquals("POST", method.get());
			assertTrue(contentType.get().startsWith("application/json"));
			assertTrue(body.get() != null && !body.get().isBlank());
			assertTrue(body.get().contains("\"prompt\":\"Do it\""));
			assertTrue(body.get().contains("\"workflow\":{"));
			assertTrue(body.get().contains("\"agents\":["));
			assertTrue(body.get().contains("\"entry_agent\":\"planner\""));
			assertTrue(body.get().contains("\"system_prompt\":\"Plan\""));
		} finally {
			server.stop(0);
		}
	}

	@Test
	void sendsNoAuthorizationHeaderWhenTokenIsNotConfigured() throws Exception {
		AtomicReference<String> authorization = new AtomicReference<>();
		HttpServer server = server(exchange -> {
			authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
			exchange.getRequestBody().readAllBytes();
			respond(exchange, 200, "{\"run_id\":\"run-1\",\"status\":\"completed\"}");
		});
		server.start();
		try {
			client(server.getAddress().getPort(), "", Duration.ofSeconds(2)).execute(request());
			assertNull(authorization.get());
		} finally {
			server.stop(0);
		}
	}

	@Test
	void mapsResponseTimeout() throws Exception {
		HttpServer server = server(exchange -> {
			exchange.getRequestBody().readAllBytes();
			try {
				Thread.sleep(400);
				respond(exchange, 200, "{}");
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
			} catch (IOException ignored) {
				// The client has already timed out and closed the connection.
			}
		});
		server.start();
		try {
			PythonEngineClient client = client(server.getAddress().getPort(), "", Duration.ofMillis(100));
			assertThrows(PythonEngineTimeoutException.class, () -> client.execute(request()));
		} finally {
			server.stop(0);
		}
	}

	@Test
	void mapsConnectionFailureWithoutRetrying() throws Exception {
		int port;
		try (ServerSocket socket = new ServerSocket(0)) {
			port = socket.getLocalPort();
		}
		PythonEngineClient client = client(port, "", Duration.ofSeconds(1));
		assertThrows(PythonEngineUnavailableException.class, () -> client.execute(request()));
	}

	private static PythonEngineClient client(int port, String token, Duration responseTimeout) {
		EngineProperties properties = new EngineProperties(URI.create("http://127.0.0.1:" + port), token,
				Duration.ofSeconds(1), responseTimeout);
		HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
		return new PythonEngineClient(httpClient, new ObjectMapper(), properties);
	}

	private static EngineRunRequest request() {
		return new EngineRunRequest("Do it",
				new EngineWorkflowRequest("support", "Support", "planner", 8,
						List.of(new EngineEdgeRequest("planner", "writer"))),
				List.of(new EngineAgentRequest("planner", "Planning", "Plan")));
	}

	private static HttpServer server(com.sun.net.httpserver.HttpHandler handler) throws IOException {
		HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/runs", handler);
		return server;
	}

	private static void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body)
			throws IOException {
		byte[] bytes = body.getBytes();
		exchange.getResponseHeaders().set("Content-Type", "application/json");
		exchange.sendResponseHeaders(status, bytes.length);
		exchange.getResponseBody().write(bytes);
		exchange.close();
	}
}
