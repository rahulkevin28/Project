"""Provider factory kept separate from agent and workflow logic."""

from langchain_core.language_models import BaseChatModel

from .config import Settings, get_settings


def create_chat_model(settings: Settings | None = None) -> BaseChatModel:
    """Create the configured chat model. Credentials come from environment variables."""
    config = settings or get_settings()
    provider = config.llm_provider.strip().lower()
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=config.llm_model, temperature=config.llm_temperature,
                          api_key=config.openai_api_key)
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=config.llm_model, temperature=config.llm_temperature,
                             api_key=config.anthropic_api_key)
    raise ValueError(f"Unsupported LLM_PROVIDER: {config.llm_provider!r}")
