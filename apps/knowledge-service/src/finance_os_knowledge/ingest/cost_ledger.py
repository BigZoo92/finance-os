"""AI cost-ledger ingestion.

Maps Model usage and AI cost-ledger rows into Model/AgentRun/CostObservation/
TokenUsageObservation nodes connected via USES_MODEL/CONSUMED_TOKENS/COSTS.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models import (
    KnowledgeEntity,
    KnowledgeIngestRequest,
    KnowledgeRelation,
    KnowledgeScope,
    utc_now,
)
from ._common import base_provenance, clamp_text, stable_node_id, stable_relation_id


class CostLedgerEntryInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    model: str
    skill: str | None = None
    agent_run_id: str | None = Field(default=None, alias="agentRunId")
    input_tokens: int = Field(default=0, alias="inputTokens")
    output_tokens: int = Field(default=0, alias="outputTokens")
    total_tokens: int | None = Field(default=None, alias="totalTokens")
    cost_usd: float = Field(default=0.0, alias="costUsd")
    observed_at: datetime | None = Field(default=None, alias="observedAt")
    notes: str | None = None


class CostLedgerIngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    mode: KnowledgeScope = "admin"
    source: str = "finance-os-ai-costs"
    entries: list[CostLedgerEntryInput] = Field(default_factory=list)


def build_cost_ledger_ingest(
    request: CostLedgerIngestRequest,
) -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []
    relations: list[KnowledgeRelation] = []
    seen: set[str] = set()

    for entry in request.entries:
        observed = entry.observed_at or utc_now()

        model_id = stable_node_id("ai:model", entry.model)
        if model_id not in seen:
            entities.append(
                KnowledgeEntity(
                    id=model_id,
                    type="Model",
                    label=entry.model,
                    description=f"AI model: {entry.model}",
                    source="finance-os-ai-costs",
                    confidence=0.85,
                    scope=request.mode,
                    tags=["ai", "model"],
                    observedAt=observed,
                    provenance=[
                        base_provenance(
                            source="finance-os-ai-costs",
                            source_type="metric",
                            source_ref=f"model:{entry.model}",
                            confidence=0.85,
                        )
                    ],
                )
            )
            seen.add(model_id)

        skill_id: str | None = None
        if entry.skill:
            skill_id = stable_node_id("ai:skill", entry.skill)
            if skill_id not in seen:
                entities.append(
                    KnowledgeEntity(
                        id=skill_id,
                        type="AgentSkill",
                        label=entry.skill,
                        description=f"AI skill: {entry.skill}",
                        source="finance-os-ai-costs",
                        confidence=0.8,
                        scope=request.mode,
                        tags=["ai", "skill"],
                        observedAt=observed,
                        provenance=[
                            base_provenance(
                                source="finance-os-ai-costs",
                                source_type="metric",
                                source_ref=f"skill:{entry.skill}",
                                confidence=0.8,
                            )
                        ],
                    )
                )
                seen.add(skill_id)

        run_id = stable_node_id(
            "ai:run", entry.agent_run_id or entry.id, entry.model, entry.skill or ""
        )
        if run_id not in seen:
            entities.append(
                KnowledgeEntity(
                    id=run_id,
                    type="AgentRun",
                    label=f"AgentRun {entry.agent_run_id or entry.id}",
                    description=clamp_text(entry.notes, max_length=320),
                    source="finance-os-ai-costs",
                    confidence=0.85,
                    scope=request.mode,
                    tags=["ai", "agent-run"],
                    observedAt=observed,
                    sourceTimestamp=observed,
                    provenance=[
                        base_provenance(
                            source="finance-os-ai-costs",
                            source_type="run",
                            source_ref=f"run:{entry.agent_run_id or entry.id}",
                            confidence=0.85,
                            source_timestamp=observed,
                        )
                    ],
                    metadata={
                        "modelId": entry.model,
                        "skill": entry.skill,
                    },
                )
            )
            seen.add(run_id)

        # Token usage observation
        token_id = stable_node_id("ai:tokens", entry.id)
        total_tokens = entry.total_tokens or (entry.input_tokens + entry.output_tokens)
        if token_id not in seen:
            entities.append(
                KnowledgeEntity(
                    id=token_id,
                    type="TokenUsageObservation",
                    label=f"Tokens for {entry.id}",
                    description=f"input={entry.input_tokens} output={entry.output_tokens} total={total_tokens}",
                    source="finance-os-ai-costs",
                    confidence=0.95,
                    scope=request.mode,
                    tags=["ai", "tokens"],
                    observedAt=observed,
                    sourceTimestamp=observed,
                    provenance=[
                        base_provenance(
                            source="finance-os-ai-costs",
                            source_type="metric",
                            source_ref=f"tokens:{entry.id}",
                            confidence=0.95,
                            source_timestamp=observed,
                        )
                    ],
                    metadata={
                        "inputTokens": entry.input_tokens,
                        "outputTokens": entry.output_tokens,
                        "totalTokens": total_tokens,
                    },
                )
            )
            seen.add(token_id)

        # Cost observation
        cost_id = stable_node_id("ai:cost", entry.id)
        if cost_id not in seen:
            entities.append(
                KnowledgeEntity(
                    id=cost_id,
                    type="CostObservation",
                    label=f"Cost {entry.id}: ${entry.cost_usd:.4f}",
                    description=f"Cost {entry.cost_usd:.6f} USD for model {entry.model}",
                    source="finance-os-ai-costs",
                    confidence=0.95,
                    scope=request.mode,
                    tags=["ai", "cost"],
                    observedAt=observed,
                    sourceTimestamp=observed,
                    provenance=[
                        base_provenance(
                            source="finance-os-ai-costs",
                            source_type="metric",
                            source_ref=f"cost:{entry.id}",
                            confidence=0.95,
                            source_timestamp=observed,
                        )
                    ],
                    metadata={
                        "costUsd": entry.cost_usd,
                        "modelId": entry.model,
                    },
                )
            )
            seen.add(cost_id)

        # Relations
        relations.append(
            KnowledgeRelation(
                id=stable_relation_id("USES_MODEL", run_id, model_id),
                type="USES_MODEL",
                fromId=run_id,
                toId=model_id,
                label="run uses model",
                description="",
                source="finance-os-ai-costs",
                confidence=0.95,
                weight=0.7,
                scope=request.mode,
                tags=["ai", "model"],
                observedAt=observed,
                provenance=[
                    base_provenance(
                        source="finance-os-ai-costs",
                        source_type="run",
                        source_ref=f"run_model:{run_id}->{model_id}",
                        confidence=0.95,
                    )
                ],
            )
        )
        if skill_id:
            relations.append(
                KnowledgeRelation(
                    id=stable_relation_id("USES_SKILL", run_id, skill_id),
                    type="USES_SKILL",
                    fromId=run_id,
                    toId=skill_id,
                    label="run uses skill",
                    description="",
                    source="finance-os-ai-costs",
                    confidence=0.9,
                    weight=0.6,
                    scope=request.mode,
                    tags=["ai", "skill"],
                    observedAt=observed,
                    provenance=[
                        base_provenance(
                            source="finance-os-ai-costs",
                            source_type="run",
                            source_ref=f"run_skill:{run_id}->{skill_id}",
                            confidence=0.9,
                        )
                    ],
                )
            )
        relations.append(
            KnowledgeRelation(
                id=stable_relation_id("CONSUMED_TOKENS", run_id, token_id),
                type="CONSUMED_TOKENS",
                fromId=run_id,
                toId=token_id,
                label="run consumed tokens",
                description="",
                source="finance-os-ai-costs",
                confidence=0.95,
                weight=0.55,
                scope=request.mode,
                tags=["ai", "tokens"],
                observedAt=observed,
                provenance=[
                    base_provenance(
                        source="finance-os-ai-costs",
                        source_type="metric",
                        source_ref=f"run_tokens:{run_id}->{token_id}",
                        confidence=0.95,
                    )
                ],
            )
        )
        relations.append(
            KnowledgeRelation(
                id=stable_relation_id("COSTS", run_id, cost_id),
                type="COSTS",
                fromId=run_id,
                toId=cost_id,
                label="run incurred cost",
                description="",
                source="finance-os-ai-costs",
                confidence=0.95,
                weight=0.55,
                scope=request.mode,
                tags=["ai", "cost"],
                observedAt=observed,
                provenance=[
                    base_provenance(
                        source="finance-os-ai-costs",
                        source_type="metric",
                        source_ref=f"run_cost:{run_id}->{cost_id}",
                        confidence=0.95,
                    )
                ],
            )
        )

    return KnowledgeIngestRequest(
        mode=request.mode,
        source=request.source,
        entities=entities,
        relations=relations,
        observations=[],
    )
