# syntax=docker/dockerfile:1.7
# Frozen, reproducible Python environment: dependencies come from the committed
# uv.lock only (no resolution at image build time). The `full` extra adds the
# optional research libraries.
FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.11.11 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    QUANT_SERVICE_HOST=0.0.0.0 \
    QUANT_SERVICE_PORT=8012 \
    PATH=/app/.venv/bin:$PATH

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

# Dependencies first (cache layer), then the project itself.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --extra full

COPY src ./src
RUN uv sync --frozen --no-dev --extra full

USER app
EXPOSE 8012

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8012/health', timeout=3).read()"

CMD ["python", "-m", "uvicorn", "finance_os_quant.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8012"]
