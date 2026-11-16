package com.example.demo.workflow;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowRepository extends JpaRepository<Workflow, Long> {
	@EntityGraph(attributePaths = {"agents", "edges"})
	Optional<Workflow> findForExecutionById(Long id);
}
