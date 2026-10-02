# syntax=docker/dockerfile:1.7
# Frozen, reproducible Python environment: dependencies come from the committed
# uv.lock only (no resolution at image build time).
FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.11.11 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    KNOWLEDGE_SERVICE_HOST=0.0.0.0 \
    KNOWLEDGE_SERVICE_PORT=8011 \
    PATH=/app/.venv/bin:$PATH

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /data/knowledge-graph \
    && chown -R app:app /data/knowledge-graph \
    && chmod -R u+rwX,g+rwX /data/knowledge-graph

# Dependencies first (cache layer), then the project itself.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN uv sync --frozen --no-dev

USER app
EXPOSE 8011

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8011/health', timeout=3).read()"

CMD ["python", "-m", "uvicorn", "finance_os_knowledge.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8011"]
