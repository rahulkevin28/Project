import sys
from types import ModuleType

import pytest

from engine.config import Settings
from engine.providers import create_chat_model


@pytest.mark.parametrize(
    ("provider", "module_name", "class_name", "expected_kwargs"),
    [
        (
            "google", "langchain_google_genai", "ChatGoogleGenerativeAI",
            {"model": "gemini-3.8-flash", "temperature": 0.2,
             "google_api_key": "test-google-key", "max_retries": 0},
        ),
        (
            "gemini", "langchain_google_genai", "ChatGoogleGenerativeAI",
            {"model": "gemini-3.8-flash", "temperature": 0.2,
             "google_api_key": "test-google-key", "max_retries": 0},
        ),
        (
            "anthropic", "langchain_anthropic", "ChatAnthropic",
            {"model": "claude-haiku-4-5-20251001", "temperature": 0.2,
             "api_key": "test-anthropic-key", "max_retries": 0},
        ),
    ],
)
def test_provider_uses_configured_model_and_key(
    monkeypatch, provider, module_name, class_name, expected_kwargs
):
    captured = {}

    class FakeGoogleModel:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    fake_module = ModuleType(module_name)
    setattr(fake_module, class_name, FakeGoogleModel)
    monkeypatch.setitem(sys.modules, module_name, fake_module)
    settings = Settings(
        _env_file=None,
        llm_provider=provider,
        llm_model=expected_kwargs["model"],
        llm_temperature=0.2,
        google_api_key="test-google-key" if provider in {"google", "gemini"} else None,
        anthropic_api_key="test-anthropic-key" if provider == "anthropic" else None,
    )

    model = create_chat_model(settings)

    assert isinstance(model, FakeGoogleModel)
    assert captured == expected_kwargs
