package com.example.demo.security;

import java.io.IOException;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration {

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	UserDetailsService administratorUserDetailsService(
			@Value("${app.admin.username}") String username,
			@Value("${app.admin.password}") String password,
			PasswordEncoder passwordEncoder) {
		if (username.isBlank() || password.isBlank()) {
			throw new IllegalStateException("ADMIN_USERNAME and ADMIN_PASSWORD must be configured");
		}
		return new InMemoryUserDetailsManager(User.withUsername(username)
				.password(passwordEncoder.encode(password))
				.roles("ADMIN")
				.build());
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
		http
			.csrf(csrf -> csrf
					.csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
			.authorizeHttpRequests(authorize -> authorize
					.requestMatchers("/api/auth/csrf", "/api/auth/login", "/api/health").permitAll()
					.requestMatchers("/api/**").hasRole("ADMIN")
					.anyRequest().denyAll())
			.formLogin(form -> form
					.loginProcessingUrl("/api/auth/login")
					.successHandler((request, response, authentication) -> {
						response.setStatus(HttpStatus.OK.value());
						response.setContentType(MediaType.APPLICATION_JSON_VALUE);
						response.setHeader("Cache-Control", "no-store");
						response.getWriter().write(objectMapper.writeValueAsString(
								Map.of("username", authentication.getName())));
					})
					.failureHandler((request, response, exception) -> writeError(response,
							HttpStatus.UNAUTHORIZED, "Invalid administrator username or password.")))
			.logout(AbstractHttpConfigurer::disable)
			.exceptionHandling(errors -> errors
					.authenticationEntryPoint((request, response, exception) -> writeError(
							response, HttpStatus.UNAUTHORIZED, "Authentication is required."))
					.accessDeniedHandler((request, response, exception) -> writeError(
							response, HttpStatus.FORBIDDEN, "The request is forbidden.")));
		return http.build();
	}

	private static void writeError(jakarta.servlet.http.HttpServletResponse response,
			HttpStatus status, String message) throws IOException {
		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setHeader("Cache-Control", "no-store");
		response.getWriter().write("{\"message\":\"" + message + "\"}");
	}

}
