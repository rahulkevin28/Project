# AI Workflow Engine: the Python agent and workflow service.
# Build:  docker build -t ai-workflow-engine .
# Run:    docker run --rm -p 8765:8000 --env-file .env ai-workflow-engine
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies in their own layer, so code changes don't reinstall them.
COPY pyproject.toml ./
RUN mkdir engine && touch engine/__init__.py \
    && pip install . \
    && rm -rf engine

COPY engine ./engine
RUN pip install --no-deps --force-reinstall . \
    && useradd --create-home --uid 10001 engine

USER engine
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"]

# Settings come from environment variables (see .env.example); .env is never copied in.
CMD ["uvicorn", "engine.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
