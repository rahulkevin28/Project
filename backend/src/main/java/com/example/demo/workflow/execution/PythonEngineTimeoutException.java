package com.example.demo.workflow.execution;

public class PythonEngineTimeoutException extends PythonEngineException {
	public PythonEngineTimeoutException(Throwable cause) {
		super("The AI engine did not respond before the configured timeout", cause);
	}
}
