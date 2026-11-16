package com.example.demo.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.persistence.Column;
import java.io.InputStream;
import java.util.Locale;
import java.util.Properties;
import org.junit.jupiter.api.Test;

class WorkflowSchemaMigrationTests {

	@Test
	void flywayIsEnabledWithVersionZeroBaselineAndHibernateValidation() throws Exception {
		Properties properties = new Properties();
		try (InputStream stream = getClass().getResourceAsStream("/application.properties")) {
			properties.load(stream);
		}

		assertEquals("true", properties.getProperty("spring.flyway.enabled"));
		assertEquals("classpath:db/migration", properties.getProperty("spring.flyway.locations"));
		assertEquals("true", properties.getProperty("spring.flyway.baseline-on-migrate"));
		assertEquals("0", properties.getProperty("spring.flyway.baseline-version"));
		assertEquals("validate", properties.getProperty("spring.jpa.hibernate.ddl-auto"));
	}

	@Test
	void versionOneMigrationAddsAndBackfillsWithoutDestructiveStatements() throws Exception {
		String migration;
		try (InputStream stream = getClass().getResourceAsStream(
				"/db/migration/V1__workflow_execution_columns.sql")) {
			migration = new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
					.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
		}

		assertTrue(migration.contains("add column if not exists entry_agent"));
		assertTrue(migration.contains("add column if not exists max_handoffs"));
		assertTrue(migration.contains("set max_handoffs = 8"));
		assertTrue(migration.contains("from public.workflow_agents"));
		assertTrue(migration.contains("join public.agents"));
		assertTrue(migration.contains("order by a.id"));
		assertFalse(migration.contains("drop table"));
		assertFalse(migration.contains("delete from"));
	}

	@Test
	void entityAllowsLegacyMissingEntryAgentAndRequiresMaxHandoffs() throws Exception {
		Column entryAgent = Workflow.class.getDeclaredField("entryAgent").getAnnotation(Column.class);
		Column maxHandoffs = Workflow.class.getDeclaredField("maxHandoffs").getAnnotation(Column.class);

		assertTrue(entryAgent.nullable());
		assertFalse(maxHandoffs.nullable());
	}
}
