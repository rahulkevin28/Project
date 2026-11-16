package com.example.demo.workflow.execution;

public class PythonEngineUnavailableException extends PythonEngineException {
	public PythonEngineUnavailableException(Throwable cause) {
		super("The AI engine could not be reached", cause);
	}
}
