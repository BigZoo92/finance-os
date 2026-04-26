FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    KNOWLEDGE_SERVICE_HOST=0.0.0.0 \
    KNOWLEDGE_SERVICE_PORT=8011

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

USER app
EXPOSE 8011

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8011/health', timeout=3).read()"

CMD ["python", "-m", "uvicorn", "finance_os_knowledge.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8011"]
