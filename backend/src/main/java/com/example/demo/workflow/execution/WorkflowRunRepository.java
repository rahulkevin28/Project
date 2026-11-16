package com.example.demo.workflow.execution;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowRunRepository extends JpaRepository<WorkflowRun, Long> {
}
