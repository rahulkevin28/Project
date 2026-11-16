package com.example.demo.workflow.execution;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(EngineProperties.class)
public class EngineClientConfiguration {

	@Bean
	HttpClient pythonEngineHttpClient(EngineProperties properties) {
		return HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
	}
}
