import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import type { AdvisorKnowledgeGraphDto } from '../domain/advisor/knowledge-graph-dto'
import { createAdvisorKnowledgeRoute } from './advisor-knowledge'

const baseRouteConfig = {
  advisorEnabled: true,
  adminOnly: false,
  knowledgeConfig: {
    enabled: false,
    url: 'http://invalid.local',
    timeoutMs: 1000,
    maxContextTokens: 1800,
    retrievalMode: 'hybrid' as const,
    maxPathDepth: 3,
    minConfidence: 0,
  },
}

const createGraphTestApp = ({ mode }: { mode: 'admin' | 'demo' }) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: false,
        tokenSource: null,
      },
      requestMeta: {
        requestId: 'req-graph-test',
        startedAtMs: Date.now(),
      },
    }))
    .use(createAdvisorKnowledgeRoute(baseRouteConfig))

describe('GET /advisor/knowledge/graph', () => {
  it('returns a deterministic, well-formed DTO in demo mode', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph')
    )
    expect(response.status).toBe(200)
    const dto = (await response.json()) as AdvisorKnowledgeGraphDto
    expect(dto.meta.origin).toBe('demo')
    expect(dto.meta.scope).toBe('overview')
    expect(dto.meta.source).toBe('demo')
    expect(dto.meta.redacted).toBe(true)
    expect(dto.nodes.length).toBeGreaterThan(4)
    expect(dto.links.length).toBeGreaterThan(0)
    // Every node carries a typed origin = 'demo' in demo mode.
    for (const node of dto.nodes) expect(node.origin).toBe('demo')
    for (const link of dto.links) expect(link.origin).toBe('demo')
  })

  it('emits the same DTO on repeated calls (deterministic)', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const r1 = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?scope=overview')
    )
    const r2 = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?scope=overview')
    )
    const a = (await r1.json()) as AdvisorKnowledgeGraphDto
    const b = (await r2.json()) as AdvisorKnowledgeGraphDto
    expect(a.nodes.map(n => n.id)).toEqual(b.nodes.map(n => n.id))
    expect(a.links.map(l => `${l.source}:${l.kind}:${l.target}`)).toEqual(
      b.links.map(l => `${l.source}:${l.kind}:${l.target}`)
    )
    expect(a.meta.generatedAt).toBe(b.meta.generatedAt)
  })

  it('keeps every link endpoint pointing at an existing node', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph')
    )
    const dto = (await response.json()) as AdvisorKnowledgeGraphDto
    const ids = new Set(dto.nodes.map(n => n.id))
    for (const link of dto.links) {
      expect(ids.has(link.source)).toBe(true)
      expect(ids.has(link.target)).toBe(true)
    }
  })

  it('honors scope=personal by dropping non-personal kinds', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?scope=personal')
    )
    const dto = (await response.json()) as AdvisorKnowledgeGraphDto
    expect(dto.meta.scope).toBe('personal')
    expect(dto.nodes.length).toBeGreaterThan(0)
    for (const node of dto.nodes) {
      expect([
        'personal_snapshot',
        'financial_account',
        'transaction_cluster',
        'asset',
        'investment',
        'goal',
      ]).toContain(node.kind)
    }
  })

  it('honors limit and clamps it to [1, 1000]', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?limit=5')
    )
    const dto = (await response.json()) as AdvisorKnowledgeGraphDto
    expect(dto.nodes.length).toBeLessThanOrEqual(5)
    expect(dto.meta.nodeCount).toBe(dto.nodes.length)
  })

  it('returns an "empty" or "degraded" DTO in admin mode when the knowledge service is unavailable', async () => {
    const app = createGraphTestApp({ mode: 'admin' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph')
    )
    expect(response.status).toBe(200)
    const dto = (await response.json()) as AdvisorKnowledgeGraphDto
    // Admin without a reachable knowledge service must NEVER auto-merge demo.
    expect(dto.nodes.every(n => n.origin === 'real' || n.origin === 'example')).toBe(true)
    expect(dto.nodes.some(n => n.origin === 'demo')).toBe(false)
    expect(['empty', 'degraded', 'real']).toContain(dto.meta.origin)
    if (dto.meta.origin === 'empty' || dto.meta.origin === 'degraded') {
      expect(dto.nodes).toHaveLength(0)
      expect(dto.links).toHaveLength(0)
      expect(typeof dto.meta.reason).toBe('string')
    }
  })

  it('marks every example overlay node when includeExamples=true is set in admin', async () => {
    const app = createGraphTestApp({ mode: 'admin' })
    const response = await app.handle(
      new Request(
        'http://finance-os.local/advisor/knowledge/graph?includeExamples=true'
      )
    )
    const dto = (await response.json()) as AdvisorKnowledgeGraphDto
    expect(dto.meta.origin).toBe('mixed')
    expect(dto.nodes.length).toBeGreaterThan(0)
    // Real nodes (if any) are admin-real; example nodes are tagged origin=example AND prefixed `example:`.
    for (const node of dto.nodes) {
      if (node.origin === 'example') {
        expect(node.id.startsWith('example:')).toBe(true)
      } else if (node.origin === 'real') {
        expect(node.id.startsWith('example:')).toBe(false)
      } else {
        // Admin must not see demo nodes.
        throw new Error(`Unexpected node origin in admin/mixed: ${node.origin}`)
      }
    }
  })

  it('refuses unknown scopes via TypeBox query schema', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?scope=trading')
    )
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('refuses limit=0 and limit > 1000 via schema clamping/validation', async () => {
    const app = createGraphTestApp({ mode: 'demo' })
    const tooLow = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?limit=0')
    )
    expect(tooLow.status).toBeGreaterThanOrEqual(400)
    const tooHigh = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph?limit=5000')
    )
    expect(tooHigh.status).toBeGreaterThanOrEqual(400)
  })

  it('returns 503 ADVISOR_DISABLED when advisorEnabled is false', async () => {
    const app = new Elysia()
      .derive(() => ({
        auth: { mode: 'demo' } as const,
        internalAuth: { hasValidToken: false, tokenSource: null },
        requestMeta: { requestId: 'req-graph-test', startedAtMs: Date.now() },
      }))
      .use(
        createAdvisorKnowledgeRoute({
          ...baseRouteConfig,
          advisorEnabled: false,
        })
      )
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph')
    )
    expect(response.status).toBe(503)
    const payload = (await response.json()) as { code: string; ok: boolean }
    expect(payload.ok).toBe(false)
    expect(payload.code).toBe('ADVISOR_DISABLED')
  })

  it('returns 403 ADVISOR_ADMIN_ONLY in demo mode when adminOnly=true', async () => {
    const app = new Elysia()
      .derive(() => ({
        auth: { mode: 'demo' } as const,
        internalAuth: { hasValidToken: false, tokenSource: null },
        requestMeta: { requestId: 'req-graph-test', startedAtMs: Date.now() },
      }))
      .use(
        createAdvisorKnowledgeRoute({
          ...baseRouteConfig,
          adminOnly: true,
        })
      )
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge/graph')
    )
    expect(response.status).toBe(403)
    const payload = (await response.json()) as { code: string }
    expect(payload.code).toBe('ADVISOR_ADMIN_ONLY')
  })
})
