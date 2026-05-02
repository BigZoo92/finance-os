"""Neo4j persistence adapter for the Finance-OS knowledge graph.

This adapter is the durable graph store used by admin mode when production
backends are configured. The local in-memory store is still kept hot for
fast scoring (BM25, traversal) and as the fallback path.

Design notes:
* All nodes are labelled :KnowledgeNode plus the schema-specific node type
  (e.g. :FinancialConcept). The stable id is unique.
* Relations are stored both as typed Neo4j relationships (so Cypher
  traversal is natural) and as :KnowledgeRelation nodes are not used —
  we keep relation properties on the edge directly.
* Temporal fields, provenance JSON, confidence and scope live on the
  node/relationship properties.
* All writes are idempotent via MERGE on the stable id.

We intentionally guard every Neo4j call so missing connectivity never
hard-crashes the service: the adapter exposes `available` and a lightweight
`ping` so the parent store can route to the local fallback.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Iterable

from ..config import KnowledgeSettings
from ..models import KnowledgeEntity, KnowledgeRelation

logger = logging.getLogger("finance_os_knowledge.neo4j")


def _serialize(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return json.dumps(value, default=_serialize)
    if isinstance(value, (list, tuple)):
        return [_serialize(v) for v in value]
    return value


def _entity_props(entity: KnowledgeEntity) -> dict[str, Any]:
    return {
        "id": entity.id,
        "type": entity.type,
        "label": entity.label,
        "description": entity.description or "",
        "source": entity.source,
        "sourceUrl": entity.source_url,
        "sourceRef": entity.source_ref,
        "confidence": float(entity.confidence),
        "severity": entity.severity,
        "impact": entity.impact,
        "tags": list(entity.tags),
        "scope": entity.scope,
        "hash": entity.hash,
        "dedupeKey": entity.dedupe_key,
        "observedAt": _serialize(entity.observed_at),
        "validFrom": _serialize(entity.valid_from),
        "validTo": _serialize(entity.valid_to),
        "invalidatedAt": _serialize(entity.invalidated_at),
        "supersededBy": entity.superseded_by,
        "sourceTimestamp": _serialize(entity.source_timestamp),
        "ingestionTimestamp": _serialize(entity.ingestion_timestamp),
        "createdAt": _serialize(entity.created_at),
        "updatedAt": _serialize(entity.updated_at),
        "provenanceJson": json.dumps(
            [p.model_dump(mode="json", by_alias=True) for p in entity.provenance],
            default=_serialize,
        ),
        "metadataJson": json.dumps(entity.metadata or {}, default=_serialize),
    }


def _relation_props(relation: KnowledgeRelation) -> dict[str, Any]:
    return {
        "id": relation.id,
        "type": relation.type,
        "label": relation.label,
        "description": relation.description or "",
        "source": relation.source,
        "sourceUrl": relation.source_url,
        "sourceRef": relation.source_ref,
        "confidence": float(relation.confidence),
        "weight": float(relation.weight),
        "severity": relation.severity,
        "impact": relation.impact,
        "tags": list(relation.tags),
        "scope": relation.scope,
        "hash": relation.hash,
        "dedupeKey": relation.dedupe_key,
        "observedAt": _serialize(relation.observed_at),
        "validFrom": _serialize(relation.valid_from),
        "validTo": _serialize(relation.valid_to),
        "invalidatedAt": _serialize(relation.invalidated_at),
        "supersededBy": relation.superseded_by,
        "sourceTimestamp": _serialize(relation.source_timestamp),
        "ingestionTimestamp": _serialize(relation.ingestion_timestamp),
        "createdAt": _serialize(relation.created_at),
        "updatedAt": _serialize(relation.updated_at),
        "provenanceJson": json.dumps(
            [p.model_dump(mode="json", by_alias=True) for p in relation.provenance],
            default=_serialize,
        ),
        "metadataJson": json.dumps(relation.metadata or {}, default=_serialize),
    }


@dataclass
class Neo4jAdapter:
    settings: KnowledgeSettings
    _driver: Any = field(default=None, init=False, repr=False)
    _available: bool = field(default=False, init=False)
    _last_error: str | None = field(default=None, init=False)
    _initialized: bool = field(default=False, init=False)

    @property
    def available(self) -> bool:
        return self._available

    @property
    def last_error(self) -> str | None:
        return self._last_error

    @property
    def database(self) -> str:
        return self.settings.neo4j_database

    def connect(self) -> bool:
        if (
            not self.settings.neo4j_uri
            or not self.settings.neo4j_user
            or not self.settings.neo4j_password
        ):
            self._available = False
            self._last_error = "neo4j_not_configured"
            return False
        try:
            from neo4j import GraphDatabase  # type: ignore[import-not-found]
        except Exception as exc:  # pragma: no cover - optional at runtime
            self._available = False
            self._last_error = f"neo4j_driver_missing:{type(exc).__name__}"
            return False

        try:
            driver = GraphDatabase.driver(
                self.settings.neo4j_uri,
                auth=(self.settings.neo4j_user, self.settings.neo4j_password),
            )
            with driver.session(database=self.database) as session:
                session.run("RETURN 1 AS ok").consume()
            self._driver = driver
            self._available = True
            self._last_error = None
            return True
        except Exception as exc:
            self._driver = None
            self._available = False
            self._last_error = f"neo4j_connect_failed:{type(exc).__name__}"
            logger.warning("neo4j connection failed: %s", type(exc).__name__)
            return False

    def close(self) -> None:
        if self._driver is not None:
            try:
                self._driver.close()
            except Exception:  # pragma: no cover - defensive
                pass
            self._driver = None
            self._available = False

    def ping(self) -> bool:
        if not self._driver:
            return self.connect()
        try:
            with self._driver.session(database=self.database) as session:
                session.run("RETURN 1 AS ok").consume()
            self._available = True
            self._last_error = None
            return True
        except Exception as exc:
            self._available = False
            self._last_error = f"neo4j_ping_failed:{type(exc).__name__}"
            return False

    def ensure_schema(self) -> None:
        if not self._driver:
            return
        statements = [
            "CREATE CONSTRAINT knowledge_node_id IF NOT EXISTS "
            "FOR (n:KnowledgeNode) REQUIRE n.id IS UNIQUE",
            "CREATE INDEX knowledge_node_type IF NOT EXISTS FOR (n:KnowledgeNode) ON (n.type)",
            "CREATE INDEX knowledge_node_scope IF NOT EXISTS FOR (n:KnowledgeNode) ON (n.scope)",
            "CREATE INDEX knowledge_node_source IF NOT EXISTS FOR (n:KnowledgeNode) ON (n.source)",
            "CREATE INDEX knowledge_node_confidence IF NOT EXISTS "
            "FOR (n:KnowledgeNode) ON (n.confidence)",
            "CREATE INDEX knowledge_node_observed_at IF NOT EXISTS "
            "FOR (n:KnowledgeNode) ON (n.observedAt)",
            "CREATE INDEX knowledge_node_valid_from IF NOT EXISTS "
            "FOR (n:KnowledgeNode) ON (n.validFrom)",
            "CREATE INDEX knowledge_node_valid_to IF NOT EXISTS "
            "FOR (n:KnowledgeNode) ON (n.validTo)",
        ]
        fulltext = (
            "CREATE FULLTEXT INDEX knowledge_node_fulltext IF NOT EXISTS "
            "FOR (n:KnowledgeNode) ON EACH [n.label, n.description, n.tags]"
        )
        try:
            with self._driver.session(database=self.database) as session:
                for stmt in statements:
                    session.run(stmt).consume()
                try:
                    session.run(fulltext).consume()
                except Exception as exc:  # pragma: no cover - older neo4j may differ
                    logger.warning("fulltext index creation skipped: %s", type(exc).__name__)
            self._initialized = True
        except Exception as exc:
            self._available = False
            self._last_error = f"neo4j_schema_failed:{type(exc).__name__}"
            logger.warning("neo4j schema creation failed: %s", type(exc).__name__)

    def upsert_entities(self, entities: Iterable[KnowledgeEntity]) -> int:
        if not self._driver:
            return 0
        rows = [_entity_props(entity) for entity in entities]
        if not rows:
            return 0
        cypher = (
            "UNWIND $rows AS row "
            "MERGE (n:KnowledgeNode {id: row.id}) "
            "SET n += row "
            "WITH n, row "
            "CALL apoc.create.addLabels(n, [row.type]) YIELD node "
            "RETURN count(node) AS count"
        )
        cypher_no_apoc = (
            "UNWIND $rows AS row "
            "MERGE (n:KnowledgeNode {id: row.id}) "
            "SET n += row "
            "RETURN count(n) AS count"
        )
        try:
            with self._driver.session(database=self.database) as session:
                try:
                    record = session.run(cypher, rows=rows).single()
                except Exception:
                    record = session.run(cypher_no_apoc, rows=rows).single()
            return int(record["count"]) if record else 0
        except Exception as exc:
            self._available = False
            self._last_error = f"neo4j_upsert_entities_failed:{type(exc).__name__}"
            logger.warning("neo4j entity upsert failed: %s", type(exc).__name__)
            return 0

    def upsert_relations(self, relations: Iterable[KnowledgeRelation]) -> int:
        if not self._driver:
            return 0
        rows = [
            _relation_props(rel) | {"fromId": rel.from_id, "toId": rel.to_id} for rel in relations
        ]
        if not rows:
            return 0
        # Group by relation type because Cypher requires a literal type. Use a
        # parameterized template per type batch to remain performant.
        by_type: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            by_type.setdefault(row["type"], []).append(row)
        total = 0
        try:
            with self._driver.session(database=self.database) as session:
                for rel_type, batch in by_type.items():
                    safe_type = "".join(c if c.isalnum() or c == "_" else "_" for c in rel_type)
                    cypher = (
                        "UNWIND $rows AS row "
                        "MATCH (from:KnowledgeNode {id: row.fromId}) "
                        "MATCH (to:KnowledgeNode {id: row.toId}) "
                        f"MERGE (from)-[r:`{safe_type}` {{id: row.id}}]->(to) "
                        "SET r += row "
                        "RETURN count(r) AS count"
                    )
                    record = session.run(cypher, rows=batch).single()
                    if record:
                        total += int(record["count"])
            return total
        except Exception as exc:
            self._available = False
            self._last_error = f"neo4j_upsert_relations_failed:{type(exc).__name__}"
            logger.warning("neo4j relation upsert failed: %s", type(exc).__name__)
            return 0

    def reset(self) -> None:
        if not self._driver:
            return
        try:
            with self._driver.session(database=self.database) as session:
                session.run("MATCH (n:KnowledgeNode) DETACH DELETE n").consume()
        except Exception as exc:
            self._last_error = f"neo4j_reset_failed:{type(exc).__name__}"
            logger.warning("neo4j reset failed: %s", type(exc).__name__)

    def stats(self) -> dict[str, Any]:
        if not self._driver:
            return {"available": False, "error": self._last_error}
        try:
            with self._driver.session(database=self.database) as session:
                node_count = (
                    session.run("MATCH (n:KnowledgeNode) RETURN count(n) AS c").single() or {}
                ).get("c", 0)
                rel_count = (
                    session.run(
                        "MATCH (:KnowledgeNode)-[r]->(:KnowledgeNode) RETURN count(r) AS c"
                    ).single()
                    or {}
                ).get("c", 0)
            return {
                "available": True,
                "nodes": int(node_count),
                "relations": int(rel_count),
                "database": self.database,
            }
        except Exception as exc:
            self._available = False
            self._last_error = f"neo4j_stats_failed:{type(exc).__name__}"
            return {"available": False, "error": self._last_error}

    def fetch_all(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Return raw rows so the local store can hydrate from Neo4j."""
        if not self._driver:
            return [], []
        try:
            with self._driver.session(database=self.database) as session:
                node_records = session.run(
                    "MATCH (n:KnowledgeNode) RETURN properties(n) AS props"
                ).data()
                rel_records = session.run(
                    "MATCH (a:KnowledgeNode)-[r]->(b:KnowledgeNode) "
                    "RETURN properties(r) AS props, a.id AS fromId, b.id AS toId, type(r) AS relType"
                ).data()
            nodes = [row["props"] for row in node_records]
            relations: list[dict[str, Any]] = []
            for row in rel_records:
                props = dict(row["props"])
                props.setdefault("fromId", row["fromId"])
                props.setdefault("toId", row["toId"])
                props.setdefault("type", row["relType"])
                relations.append(props)
            return nodes, relations
        except Exception as exc:
            self._available = False
            self._last_error = f"neo4j_fetch_failed:{type(exc).__name__}"
            return [], []
