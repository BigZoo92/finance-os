"""Production-grade backends for the Finance-OS knowledge service.

The local in-memory + JSON store remains in `store.py` and acts as the
deterministic fallback for demo, tests, and degraded operation. The modules
in this package implement the real Neo4j (graph persistence) and Qdrant
(vector retrieval) adapters that admin mode uses when configured.
"""
from .embeddings import EmbeddingProvider, build_embedding_provider
from .factory import select_backend
from .neo4j_adapter import Neo4jAdapter
from .production_store import ProductionKnowledgeStore
from .qdrant_adapter import QdrantAdapter

__all__ = [
    "EmbeddingProvider",
    "Neo4jAdapter",
    "ProductionKnowledgeStore",
    "QdrantAdapter",
    "build_embedding_provider",
    "select_backend",
]
