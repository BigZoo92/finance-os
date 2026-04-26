# Knowledge Graph Context Pack — Finance-OS

> Auto-generated. Source: docs/adr/temporal-knowledge-graph-graphrag.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Architecture Summary

The Temporal Knowledge Graph / GraphRAG layer provides AI Advisor memory:
- Neo4j for entity relationships + temporal validity
- Qdrant for semantic vector search
- Local deterministic fallback when services unavailable
- apps/knowledge-service (Python FastAPI) as internal-only service

## Key Constraints

- Internal-only, never publicly exposed
- Not a source of truth for transactions
- Not part of the agentic development pipeline
- Must fail soft when unavailable
- Demo mode uses deterministic fixtures only
- Agentic dev observations are tagged domain='agentic' and isolated from financial data
