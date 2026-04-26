from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class KnowledgeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_host: str = Field(default="127.0.0.1", alias="KNOWLEDGE_SERVICE_HOST")
    service_port: int = Field(default=8011, alias="KNOWLEDGE_SERVICE_PORT")
    service_enabled: bool = Field(default=True, alias="KNOWLEDGE_SERVICE_ENABLED")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")

    graph_backend: Literal["local", "neo4j", "memgraph", "falkordb"] = Field(
        default="local", alias="KNOWLEDGE_GRAPH_BACKEND"
    )
    graph_storage_path: Path = Field(
        default=Path("./.knowledge/graph"), alias="KNOWLEDGE_GRAPH_STORAGE_PATH"
    )
    rebuild_on_start: bool = Field(default=True, alias="KNOWLEDGE_GRAPH_REBUILD_ON_START")
    max_context_tokens: int = Field(default=1800, alias="KNOWLEDGE_GRAPH_MAX_CONTEXT_TOKENS")
    vector_enabled: bool = Field(default=True, alias="KNOWLEDGE_GRAPH_VECTOR_ENABLED")
    fulltext_enabled: bool = Field(default=True, alias="KNOWLEDGE_GRAPH_FULLTEXT_ENABLED")
    temporal_enabled: bool = Field(default=True, alias="KNOWLEDGE_GRAPH_TEMPORAL_ENABLED")
    demo_fixtures_enabled: bool = Field(
        default=True, alias="KNOWLEDGE_GRAPH_DEMO_FIXTURES_ENABLED"
    )
    retrieval_mode: Literal["hybrid", "graph", "vector", "fulltext"] = Field(
        default="hybrid", alias="KNOWLEDGE_GRAPH_RETRIEVAL_MODE"
    )
    reranking_enabled: bool = Field(default=True, alias="KNOWLEDGE_GRAPH_RERANKING_ENABLED")
    max_path_depth: int = Field(default=3, alias="KNOWLEDGE_GRAPH_MAX_PATH_DEPTH")
    min_confidence: float = Field(default=0.35, alias="KNOWLEDGE_GRAPH_MIN_CONFIDENCE")
    recency_half_life_days: float = Field(
        default=45.0, alias="KNOWLEDGE_GRAPH_RECENCY_HALF_LIFE_DAYS"
    )
    embedding_provider: Literal["local", "openai", "none"] = Field(
        default="local", alias="KNOWLEDGE_GRAPH_EMBEDDING_PROVIDER"
    )
    embedding_model: str = Field(default="local-hashing-v1", alias="KNOWLEDGE_GRAPH_EMBEDDING_MODEL")

    neo4j_uri: str | None = Field(default=None, alias="NEO4J_URI")
    neo4j_username: str | None = Field(default=None, alias="NEO4J_USERNAME")
    neo4j_password: str | None = Field(default=None, alias="NEO4J_PASSWORD")
    qdrant_url: str | None = Field(default=None, alias="QDRANT_URL")
    qdrant_api_key: str | None = Field(default=None, alias="QDRANT_API_KEY")


@lru_cache(maxsize=1)
def get_settings() -> KnowledgeSettings:
    return KnowledgeSettings()
