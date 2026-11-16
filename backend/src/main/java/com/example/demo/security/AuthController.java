package com.example.demo.security;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
	private final boolean sessionCookieSecure;

	public AuthController(@Value("${server.servlet.session.cookie.secure:true}") boolean sessionCookieSecure) {
		this.sessionCookieSecure = sessionCookieSecure;
	}

	@GetMapping("/csrf")
	public ResponseEntity<CsrfResponse> csrf(CsrfToken csrfToken, HttpServletResponse response) {
		response.setHeader("Cache-Control", "no-store");
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.body(new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getToken()));
	}

	@GetMapping("/session")
	public ResponseEntity<SessionResponse> session(Authentication authentication) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.body(new SessionResponse(authentication.getName()));
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
		new SecurityContextLogoutHandler().logout(request, response,
				SecurityContextHolder.getContext().getAuthentication());
		ResponseCookie expiredSessionCookie = ResponseCookie.from("JSESSIONID", "")
				.path("/").httpOnly(true).secure(sessionCookieSecure).sameSite("Strict").maxAge(Duration.ZERO).build();
		response.addHeader(HttpHeaders.SET_COOKIE, expiredSessionCookie.toString());
		return ResponseEntity.noContent().build();
	}

	public record CsrfResponse(String headerName, String token) { }

	public record SessionResponse(String username) { }
}
