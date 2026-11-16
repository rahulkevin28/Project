package com.example.demo.workflow.execution;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "engine")
public record EngineProperties(URI baseUrl, String apiToken, Duration connectTimeout,
		Duration responseTimeout) {
}
