# Finance-OS Knowledge Service

Internal-only Temporal Financial Knowledge Graph Memory service.

The production architecture targets Neo4j for the temporal property graph and Qdrant for hybrid vector/sparse retrieval. This service also ships with a deterministic local JSON graph backend so development, tests, and demo mode do not require external services or provider calls.

Run locally:

```bash
python -m pip install -e apps/knowledge-service[dev]
python -m uvicorn finance_os_knowledge.app:create_app --factory --app-dir apps/knowledge-service/src --host 127.0.0.1 --port 8011
```

Rebuild deterministic seed memory:

```bash
curl -X POST http://127.0.0.1:8011/knowledge/rebuild -H "content-type: application/json" -d "{\"scope\":\"admin\",\"includeSeed\":true}"
```

No endpoint performs trading execution or external provider calls. Embeddings default to deterministic local hashing unless an explicit server-only embedding provider is configured later.
