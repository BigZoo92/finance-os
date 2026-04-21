import { describe, expect, it } from 'bun:test'
import type { DashboardAdvisorRepository } from '../../types'
import { createDashboardAdvisorUseCases } from './create-dashboard-advisor-use-cases'

const unexpectedCall = (label: string) => () => {
  throw new Error(`Unexpected call: ${label}`)
}

const createExplodingRepository = () =>
  new Proxy(
    {},
    {
      get(_target, property) {
        return unexpectedCall(`repository.${String(property)}`)
      },
    }
  ) as DashboardAdvisorRepository

const config = {
  advisorEnabled: true,
  adminOnly: false,
  forceLocalOnly: false,
  knowledgeRetrievalEnabled: true,
  chatEnabled: true,
  challengerEnabled: true,
  relabelEnabled: true,
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  challengerDisableRatio: 0.75,
  deepAnalysisDisableRatio: 0.5,
  maxChatMessagesContext: 8,
  usdToEurRate: 0.92,
  openAi: null,
  anthropic: null,
} as const

describe('createDashboardAdvisorUseCases', () => {
  it('keeps the demo overview, knowledge Q&A, and chat fully local', async () => {
    const useCases = createDashboardAdvisorUseCases({
      repository: createExplodingRepository(),
      getSummary: async () => {
        throw new Error('summary should not be called in demo')
      },
      getGoals: async () => {
        throw new Error('goals should not be called in demo')
      },
      getTransactions: async () => {
        throw new Error('transactions should not be called in demo')
      },
      config,
    })

    const overview = await useCases.getAdvisorOverview({
      mode: 'demo',
      requestId: 'req-demo',
    })
    const topics = await useCases.getAdvisorKnowledgeTopics({
      mode: 'demo',
      requestId: 'req-demo',
    })
    const answer = await useCases.getAdvisorKnowledgeAnswer({
      mode: 'demo',
      requestId: 'req-demo',
      question: 'Pourquoi diversifier un portefeuille ?',
    })
    const chat = await useCases.postAdvisorChat({
      mode: 'demo',
      requestId: 'req-demo',
      message: 'Pourquoi tu me conseilles cela ?',
    })

    expect(overview.mode).toBe('demo')
    expect(overview.source).toBe('demo_fixture')
    expect(overview.chatEnabled).toBe(false)
    expect(overview.topRecommendations.length).toBeGreaterThan(0)

    expect(topics.mode).toBe('demo')
    expect(topics.retrievalEnabled).toBe(true)
    expect(topics.topics.length).toBeGreaterThan(0)

    expect(answer.mode).toBe('demo')
    expect(answer.status).toBe('answered')
    expect(answer.source).toBe('demo_fixture')
    expect(answer.citations.length).toBeGreaterThan(0)

    expect(chat.ok).toBe(true)
    expect(chat.thread.messages).toHaveLength(2)
    expect(chat.thread.messages[1]?.content).toContain('Mode demo')
    expect(chat.thread.messages[1]?.assumptions).toContain(
      'Mode demo sans persistence ni appel provider.'
    )
  })

  it('falls back to browse-only knowledge mode when provider-disable is active', async () => {
    const useCases = createDashboardAdvisorUseCases({
      repository: createExplodingRepository(),
      getSummary: async () => {
        throw new Error('summary should not be called in browse-only knowledge mode')
      },
      getGoals: async () => {
        throw new Error('goals should not be called in browse-only knowledge mode')
      },
      getTransactions: async () => {
        throw new Error('transactions should not be called in browse-only knowledge mode')
      },
      config: {
        ...config,
        forceLocalOnly: true,
      },
    })

    const topics = await useCases.getAdvisorKnowledgeTopics({
      mode: 'admin',
      requestId: 'req-admin',
    })
    const answer = await useCases.getAdvisorKnowledgeAnswer({
      mode: 'admin',
      requestId: 'req-admin',
      question: 'Pourquoi diversifier un portefeuille ?',
    })

    expect(topics.retrievalEnabled).toBe(false)
    expect(topics.browseOnlyReason).toBe('provider_disable_switch')
    expect(answer.status).toBe('browse_only')
    expect(answer.fallbackReason).toBe('provider_disable_switch')
    expect(answer.answer).toBeNull()
    expect(answer.suggestedTopics.length).toBeGreaterThan(0)
  })
})
