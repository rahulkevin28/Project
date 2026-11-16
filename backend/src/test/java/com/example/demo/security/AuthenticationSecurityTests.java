package com.example.demo.security;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import com.example.demo.agent.AgentService;
import com.example.demo.agent.AgentController;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.core.env.Environment;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = {AuthController.class, AgentController.class, HealthController.class})
@Import(SecurityConfiguration.class)
@TestPropertySource(properties = {
		"app.admin.username=test-admin",
		"app.admin.password=test-password",
		"server.servlet.session.cookie.secure=true"
})
class AuthenticationSecurityTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserDetailsService userDetailsService;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private Environment environment;

	@MockitoBean
	private AgentService agentService;

	@Test
	void administratorPasswordIsStoredAsBcrypt() {
		String encoded = userDetailsService.loadUserByUsername("test-admin").getPassword();
		assertTrue(encoded.startsWith("$2"));
		assertTrue(passwordEncoder.matches("test-password", encoded));
	}

	@Test
	void sessionsUseSecureHttpOnlyStrictCookiesAndExpireAfterThirtyMinutes() {
		assertEquals("true", environment.getProperty("server.servlet.session.cookie.http-only"));
		assertEquals("true", environment.getProperty("server.servlet.session.cookie.secure"));
		assertEquals("strict", environment.getProperty("server.servlet.session.cookie.same-site"));
		assertEquals("30m", environment.getProperty("server.servlet.session.timeout"));
	}

	@Test
	void unauthenticatedApiRequestsReceive401AndHealthRemainsPublic() throws Exception {
		mockMvc.perform(get("/api/agents"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value("Authentication is required."));
		mockMvc.perform(get("/api/auth/session"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/health"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("ok"));
	}

	@Test
	void csrfBootstrapReturnsSessionBoundRequestToken() throws Exception {
		mockMvc.perform(get("/api/auth/csrf"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
				.andExpect(jsonPath("$.token").isNotEmpty());
	}

	@Test
	void successfulLoginCreatesSessionAndAllowsProtectedApiAccess() throws Exception {
		when(agentService.findAll()).thenReturn(List.of());
		MvcResult login = login("test-admin", "test-password");
		MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
		assertNotNull(session);

		mockMvc.perform(get("/api/auth/session").session(session))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.username").value("test-admin"));
		mockMvc.perform(get("/api/agents").session(session))
				.andExpect(status().isOk());
	}

	@Test
	void invalidAdministratorCredentialsReceive401() throws Exception {
		mockMvc.perform(post("/api/auth/login").with(csrf())
					.contentType(MediaType.APPLICATION_FORM_URLENCODED)
					.param("username", "test-admin")
					.param("password", "incorrect"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value("Invalid administrator username or password."));
	}

	@Test
	void authenticatedMutationWithoutCsrfIsRejected() throws Exception {
		MockHttpSession session = (MockHttpSession) login("test-admin", "test-password")
				.getRequest().getSession(false);
		assertNotNull(session);

		mockMvc.perform(post("/api/agents").session(session)
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isForbidden());
		verifyNoInteractions(agentService);
	}

	@Test
	void logoutInvalidatesTheSession() throws Exception {
		MockHttpSession session = (MockHttpSession) login("test-admin", "test-password")
				.getRequest().getSession(false);
		assertNotNull(session);

		mockMvc.perform(post("/api/auth/logout").session(session).with(csrf()))
				.andExpect(status().isNoContent())
				.andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("JSESSIONID=; Path=/; Max-Age=0; Expires=")))
				.andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("HttpOnly; SameSite=Strict")))
				.andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Secure")));
		mockMvc.perform(get("/api/auth/session").session(session))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void logoutCookieOmitsSecureWhenSessionCookieSecureIsFalse() throws Exception {
		AuthController controller = new AuthController(false);
		jakarta.servlet.http.HttpServletResponse response = new org.springframework.mock.web.MockHttpServletResponse();
		controller.logout(new org.springframework.mock.web.MockHttpServletRequest(), response);
		String cookie = response.getHeader("Set-Cookie");
		assertTrue(cookie.contains("HttpOnly"));
		assertTrue(cookie.contains("SameSite=Strict"));
		assertTrue(!cookie.contains("Secure"));
	}

	@Test
	void logoutCookieIncludesSecureWhenSessionCookieSecureIsTrue() throws Exception {
		AuthController controller = new AuthController(true);
		jakarta.servlet.http.HttpServletResponse response = new org.springframework.mock.web.MockHttpServletResponse();
		controller.logout(new org.springframework.mock.web.MockHttpServletRequest(), response);
		String cookie = response.getHeader("Set-Cookie");
		assertTrue(cookie.contains("HttpOnly"));
		assertTrue(cookie.contains("SameSite=Strict"));
		assertTrue(cookie.contains("Secure"));
	}

	@Test
	void unauthenticatedLogoutDoesNotBypassAuthentication() throws Exception {
		mockMvc.perform(post("/api/auth/logout").with(csrf()))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void authenticatedNonAdministratorReceives403() throws Exception {
		mockMvc.perform(get("/api/agents").with(user("other-user")))
				.andExpect(status().isForbidden());
	}

	private MvcResult login(String username, String password) throws Exception {
		return mockMvc.perform(post("/api/auth/login").with(csrf())
					.contentType(MediaType.APPLICATION_FORM_URLENCODED)
					.param("username", username)
					.param("password", password))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.username").value(username))
				.andReturn();
	}
}
