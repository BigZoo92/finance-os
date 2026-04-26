"""Embedding providers used by the Qdrant adapter.

Default is the deterministic local hashing embedding (no network, no PII
leakage). External providers are optional and fail-soft: if they raise we
fall back to the local hashing embedding rather than blocking ingestion.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from dataclasses import dataclass
from typing import Iterable, Protocol

from ..config import KnowledgeSettings

_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_\-+.]*", re.IGNORECASE)


def _tokens(value: str) -> list[str]:
    return [match.group(0).lower() for match in _TOKEN_RE.finditer(value or "")]


def _hash_index(token: str, dimensions: int) -> int:
    digest = hashlib.blake2b(token.encode("utf-8"), digest_size=2).hexdigest()
    return int(digest, 16) % max(dimensions, 1)


def _hash_signs(token: str) -> int:
    return 1 if hashlib.blake2b(token.encode("utf-8"), digest_size=1).digest()[0] % 2 == 0 else -1


class EmbeddingProvider(Protocol):
    name: str
    dimensions: int

    def embed(self, text: str) -> list[float]:  # pragma: no cover - protocol
        ...


@dataclass
class LocalHashingEmbeddings:
    """Deterministic, dependency-free hashing embedding.

    Stable across runs and processes. No network, no provider key required.
    Suitable for both fallback and production when no external embedding
    provider is configured.
    """

    name: str = "local-hashing-v1"
    dimensions: int = 256

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = _tokens(text)
        if not tokens:
            return vector
        for token in tokens:
            index = _hash_index(token, self.dimensions)
            vector[index] += float(_hash_signs(token))
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return vector
        return [value / norm for value in vector]

    def embed_many(self, texts: Iterable[str]) -> list[list[float]]:
        return [self.embed(text) for text in texts]


@dataclass
class OpenAIEmbeddings:
    """Optional OpenAI embeddings adapter.

    Only used when explicitly enabled. Failures degrade to local hashing
    embeddings rather than blocking ingestion. The OpenAI client itself is
    imported lazily so the production image does not need the dependency
    when not used.
    """

    api_key: str
    model: str = "text-embedding-3-small"
    dimensions: int = 256
    name: str = "openai"

    def embed(self, text: str) -> list[float]:
        try:
            from openai import OpenAI  # type: ignore[import-not-found]
        except Exception:  # pragma: no cover - optional dependency
            raise RuntimeError("openai package not installed")
        client = OpenAI(api_key=self.api_key)
        response = client.embeddings.create(
            model=self.model,
            input=text,
            dimensions=self.dimensions,
        )
        return list(response.data[0].embedding)


def build_embedding_provider(settings: KnowledgeSettings) -> EmbeddingProvider:
    if settings.embedding_provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get(
            "KNOWLEDGE_OPENAI_API_KEY"
        )
        if api_key:
            try:
                return OpenAIEmbeddings(
                    api_key=api_key,
                    model=settings.embedding_model or "text-embedding-3-small",
                    dimensions=settings.embedding_dimensions,
                )
            except Exception:
                pass
    return LocalHashingEmbeddings(
        name=settings.embedding_model or "local-hashing-v1",
        dimensions=settings.embedding_dimensions,
    )
