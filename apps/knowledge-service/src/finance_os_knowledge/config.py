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
        default="local", alias="KNOWLEDGE_EMBEDDING_PROVIDER"
    )
    embedding_model: str = Field(
        default="local-hashing-v1", alias="KNOWLEDGE_EMBEDDING_MODEL"
    )
    embedding_dimensions: int = Field(
        default=256, alias="KNOWLEDGE_EMBEDDING_DIMENSIONS", ge=32, le=4096
    )

    use_production_backends: bool = Field(
        default=False, alias="KNOWLEDGE_USE_PRODUCTION_BACKENDS"
    )
    require_production_backends_in_admin: bool = Field(
        default=False, alias="KNOWLEDGE_REQUIRE_PRODUCTION_BACKENDS_IN_ADMIN"
    )
    allow_local_fallback_in_admin: bool = Field(
        default=True, alias="KNOWLEDGE_ALLOW_LOCAL_FALLBACK_IN_ADMIN"
    )

    knowledge_neo4j_uri: str | None = Field(default=None, alias="KNOWLEDGE_NEO4J_URI")
    knowledge_neo4j_user: str | None = Field(default=None, alias="KNOWLEDGE_NEO4J_USER")
    knowledge_neo4j_password: str | None = Field(
        default=None, alias="KNOWLEDGE_NEO4J_PASSWORD"
    )
    knowledge_neo4j_database: str = Field(
        default="neo4j", alias="KNOWLEDGE_NEO4J_DATABASE"
    )

    knowledge_qdrant_url: str | None = Field(default=None, alias="KNOWLEDGE_QDRANT_URL")
    knowledge_qdrant_api_key: str | None = Field(
        default=None, alias="KNOWLEDGE_QDRANT_API_KEY"
    )
    knowledge_qdrant_collection: str = Field(
        default="finance_os_knowledge", alias="KNOWLEDGE_QDRANT_COLLECTION"
    )

    legacy_neo4j_uri: str | None = Field(default=None, alias="NEO4J_URI")
    legacy_neo4j_username: str | None = Field(default=None, alias="NEO4J_USERNAME")
    legacy_neo4j_password: str | None = Field(default=None, alias="NEO4J_PASSWORD")
    legacy_qdrant_url: str | None = Field(default=None, alias="QDRANT_URL")
    legacy_qdrant_api_key: str | None = Field(default=None, alias="QDRANT_API_KEY")

    @property
    def neo4j_uri(self) -> str | None:
        return self.knowledge_neo4j_uri or self.legacy_neo4j_uri

    @property
    def neo4j_user(self) -> str | None:
        return self.knowledge_neo4j_user or self.legacy_neo4j_username

    @property
    def neo4j_password(self) -> str | None:
        return self.knowledge_neo4j_password or self.legacy_neo4j_password

    @property
    def neo4j_database(self) -> str:
        return self.knowledge_neo4j_database or "neo4j"

    @property
    def qdrant_url(self) -> str | None:
        return self.knowledge_qdrant_url or self.legacy_qdrant_url

    @property
    def qdrant_api_key(self) -> str | None:
        return self.knowledge_qdrant_api_key or self.legacy_qdrant_api_key

    @property
    def qdrant_collection(self) -> str:
        return self.knowledge_qdrant_collection or "finance_os_knowledge"

    @property
    def production_backends_configured(self) -> bool:
        return bool(
            self.use_production_backends
            and self.neo4j_uri
            and self.neo4j_user
            and self.neo4j_password
            and self.qdrant_url
        )


@lru_cache(maxsize=1)
def get_settings() -> KnowledgeSettings:
    return KnowledgeSettings()
