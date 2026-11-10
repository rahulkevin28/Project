"""Environment-backed settings; secrets are never stored in source."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from .runtime import ExecutionPolicy, ModelPrice


class Settings(BaseSettings):
    app_name: str = "AI Workflow Engine"
    log_level: str = "INFO"
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.0
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    google_api_key: str | None = None
    # Shared secret the platform backend sends as "Authorization: Bearer <token>".
    engine_api_token: str | None = None
    model_timeout_seconds: float = Field(default=300.0, gt=0)
    model_max_retries: int = Field(default=2, ge=0, le=10)
    tool_timeout_seconds: float = Field(default=30.0, gt=0)
    run_timeout_seconds: float = Field(default=900.0, gt=0)
    # Optional cost estimates, as JSON: {"model-id": {"input_per_million": 1.0, ...}}.
    model_prices: dict[str, ModelPrice] = Field(default_factory=dict)

    def execution_policy(self) -> ExecutionPolicy:
        return ExecutionPolicy(
            model_timeout_seconds=self.model_timeout_seconds,
            model_max_retries=self.model_max_retries,
            tool_timeout_seconds=self.tool_timeout_seconds,
            run_timeout_seconds=self.run_timeout_seconds,
        )

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
