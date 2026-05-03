import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Button, Input, Card, CardContent } from '@finance-os/ui/components'
import type { AuthMode } from '@/features/auth-types'
import { authMeQueryOptions } from '@/features/auth-query-options'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import {
  fetchDashboardAdvisorKnowledgeAnswer,
  getDemoDashboardAdvisorKnowledgeAnswer,
  postDashboardAdvisorChat,
} from '@/features/dashboard-api'
import {
  dashboardAdvisorChatQueryOptionsWithMode,
  dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode,
  dashboardAdvisorQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { formatDateTime, toErrorMessage } from '@/lib/format'
import { PageHeader } from '@/components/surfaces/page-header'
import { Panel } from '@/components/surfaces/panel'
import { StatusDot } from '@/components/surfaces/status-dot'
import {
  AdvisorQuestionStarters,
  type AdvisorQuestionStarter,
} from '@/components/advisor/advisor-decision-ui'

const advisorThreadKey = 'default'

const CHAT_QUESTIONS: AdvisorQuestionStarter[] = [
  {
    label: 'Est-ce que je peux investir ce mois-ci ?',
    detail: 'Avec limites, horizon et données manquantes.',
    prompt: 'Est-ce que je peux investir ce mois-ci ? Réponds avec prudence, limites et données manquantes.',
    tone: 'brand',
  },
  {
    label: 'Qu’est-ce qui a changé récemment ?',
    detail: 'Dépenses, patrimoine, recommandations.',
    prompt: 'Qu’est-ce qui a le plus changé récemment dans mes finances Finance-OS ?',
    tone: 'plain',
  },
  {
    label: 'Quelles données dois-je vérifier ?',
    detail: 'Fraîcheur, comptes, hypothèses, profil.',
    prompt: 'Quelles données dois-je vérifier avant de suivre une recommandation Advisor ?',
    tone: 'warning',
  },
  {
    label: 'Explique-moi la recommandation principale',
    detail: 'Pourquoi, risques, prochaine question.',
    prompt: 'Explique-moi la recommandation principale avec les données utilisées, les hypothèses et les risques.',
    tone: 'plain',
  },
]

export const Route = createFileRoute('/_app/ia/chat')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const advisorFlags = getAiAdvisorUiFlags()
    const advisorVisible = advisorFlags.enabled && (!advisorFlags.adminOnly || mode === 'admin')
    if (!advisorVisible) return

    await Promise.all([
      context.queryClient.ensureQueryData(
        dashboardAdvisorQueryOptionsWithMode({ mode, range: '30d' })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorChatQueryOptionsWithMode({ mode, threadKey: advisorThreadKey })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode({ mode })
      ),
    ])
  },
  component: IaChatPage,
})

function IaChatPage() {
  const queryClient = useQueryClient()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined

  const aiAdvisorFlags = getAiAdvisorUiFlags()
  const aiAdvisorVisible = aiAdvisorFlags.enabled && (!aiAdvisorFlags.adminOnly || isAdmin)
  const modeOpts = aiAdvisorVisible && authMode ? { mode: authMode } : {}

  const [chatDraft, setChatDraft] = useState('')
  const [knowledgeDraft, setKnowledgeDraft] = useState('')

  const chatQuery = useQuery({
    ...dashboardAdvisorChatQueryOptionsWithMode({ ...modeOpts, threadKey: advisorThreadKey }),
    refetchInterval: false,
  })
  const overviewQuery = useQuery(
    dashboardAdvisorQueryOptionsWithMode({ ...modeOpts, range: '30d' })
  )
  const knowledgeTopicsQuery = useQuery(
    dashboardAdvisorKnowledgeTopicsQueryOptionsWithMode(modeOpts)
  )

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      postDashboardAdvisorChat({ threadKey: advisorThreadKey, message }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.advisorChat(advisorThreadKey) })
    },
  })

  const knowledgeAnswerMutation = useMutation({
    mutationFn: (question: string) => {
      if (authMode === 'demo') {
        return Promise.resolve(getDemoDashboardAdvisorKnowledgeAnswer(question))
      }
      return fetchDashboardAdvisorKnowledgeAnswer(question)
    },
  })

  const handleSendChat = () => {
    const normalized = chatDraft.trim()
    if (!normalized) return
    if (!isAdmin || overviewQuery.data?.chatEnabled === false) return
    chatMutation.mutate(normalized)
    setChatDraft('')
  }

  const handleAskKnowledge = (overrideQuestion?: string) => {
    const normalized = (overrideQuestion ?? knowledgeDraft).trim()
    if (!normalized) return
    knowledgeAnswerMutation.mutate(normalized)
    if (!overrideQuestion) setKnowledgeDraft('')
    else setKnowledgeDraft(normalized)
  }

  if (!aiAdvisorVisible) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Advisor IA · Chat"
          icon="◬"
          title="Chat finance"
          description="Pose une question à l'Advisor sur tes dépenses, ton patrimoine ou tes investissements."
        />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Advisor IA indisponible sur cette session.
          </CardContent>
        </Card>
      </div>
    )
  }

  const messages = chatQuery.data?.messages ?? []
  const overview = overviewQuery.data
  const chatCanSend = isAdmin && overview?.chatEnabled !== false
  const chatWarnings = [
    ...(isDemo ? ['Mode démo: conversation déterministe en lecture seule, aucun appel provider.'] : []),
    ...(overview?.status === 'degraded' && overview.degradedMessage ? [overview.degradedMessage] : []),
    ...(overview?.snapshot ? [] : ['Snapshot Advisor indisponible: les réponses doivent rester prudentes.']),
    ...(knowledgeTopicsQuery.data?.browseOnlyReason
      ? ['Q&A connaissance en mode browse-only: la récupération est limitée.']
      : []),
    ...(!chatCanSend ? ['Envoi de message réservé à la session admin ou désactivé par configuration.'] : []),
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Advisor IA · Chat"
        icon="◬"
        title="Chat finance"
        description="Pose une question sur tes données Finance-OS. La réponse reste une aide à la décision, pas une instruction d'investissement."
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Cadre de réponse"
          description="L'Advisor doit dire ce qu'il sait, ce qui manque, et où la confiance baisse."
          icon={<span aria-hidden="true">□</span>}
          tone="brand"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ChatPrinciple title="Ancré" text="Réponses basées sur les artefacts Finance-OS disponibles." />
            <ChatPrinciple title="Prudent" text="Pas de buy/sell now, pas d'exécution, pas de promesse de rendement." />
            <ChatPrinciple title="Traçable" text="Hypothèses, caveats et données manquantes doivent rester visibles." />
          </div>
        </Panel>

        <Panel
          title={chatWarnings.length > 0 ? 'Données à vérifier' : 'Contexte utilisable'}
          description="Fraîcheur, mode et disponibilité du contexte avant de poser une question."
          icon={<StatusDot tone={chatWarnings.length > 0 ? 'warn' : 'ok'} size={8} pulse={chatWarnings.length > 0} />}
          tone={chatWarnings.length > 0 ? 'warning' : 'positive'}
        >
          <div className="space-y-2">
            {chatWarnings.length > 0 ? (
              chatWarnings.map(item => (
                <p key={item} className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-2 text-sm text-muted-foreground">
                  {item}
                </p>
              ))
            ) : (
              <p className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3 text-sm text-muted-foreground">
                Le chat peut utiliser les artefacts Advisor récents. Vérifie quand même horizon, profil et liquidité avant décision.
              </p>
            )}
          </div>
        </Panel>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ── Chat thread ── */}
        <Panel
          title="Conversation"
          tone="brand"
          icon={<span aria-hidden="true">◬</span>}
          actions={
            <Badge variant="outline" className="text-[10px]">
              {chatCanSend ? `thread: ${advisorThreadKey}` : 'lecture seule'}
            </Badge>
          }
        >
          <div className="space-y-4">
            {/* Messages */}
            <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-xl border border-border/40 bg-background/60 p-4">
              {messages.length === 0 && !chatQuery.isPending && (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-foreground">Aucun message dans ce fil</p>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Choisis une question à droite ou formule une demande. L'Advisor doit répondre avec limites et hypothèses.
                  </p>
                </div>
              )}
              {chatQuery.isPending && messages.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Chargement...
                </p>
              )}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'ml-8 bg-primary/10 text-foreground'
                      : 'mr-8 border border-border/40 bg-surface-1 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                    <span className="font-mono uppercase tracking-[0.18em]">
                      {msg.role === 'user' ? 'vous' : 'advisor'}
                    </span>
                    <span>{formatDateTime(msg.createdAt)}</span>
                    {msg.model && <Badge variant="outline" className="text-[9px]">{msg.model}</Badge>}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="mr-8 rounded-xl border border-border/40 bg-surface-1 px-4 py-3">
                  <p className="text-sm text-muted-foreground animate-pulse">Advisor réfléchit...</p>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              className="flex gap-2"
              onSubmit={e => {
                e.preventDefault()
                handleSendChat()
              }}
            >
              <Input
                value={chatDraft}
                onChange={e => setChatDraft(e.target.value)}
                placeholder="Ex: quelles données manquent avant d'investir ?"
                className="min-h-11 flex-1"
                disabled={chatMutation.isPending || !chatCanSend}
              />
              <Button type="submit" disabled={chatMutation.isPending || !chatDraft.trim() || !chatCanSend}>
                Envoyer
              </Button>
            </form>
            {!chatCanSend ? (
              <p className="text-xs text-muted-foreground">
                Envoi désactivé ici. En démo, aucune mutation ni appel provider n'est lancé.
              </p>
            ) : null}
            {chatMutation.error && (
              <p className="text-xs text-negative">{toErrorMessage(chatMutation.error)}</p>
            )}
          </div>
        </Panel>

        {/* ── Knowledge Q&A + topics ── */}
        <div className="space-y-4">
          <Panel
            title="Questions à poser"
            description="Point de départ contextualisé. Tu peux modifier le texte avant envoi."
            icon={<span aria-hidden="true">?</span>}
            tone="violet"
          >
            <AdvisorQuestionStarters questions={CHAT_QUESTIONS} onSelect={setChatDraft} />
          </Panel>

          <Panel
            title="Comprendre un concept"
            tone="violet"
            icon={<span aria-hidden="true">[#]</span>}
            description="Question éducative sur un concept financier. Séparé des décisions personnelles."
          >
            <form
              className="flex gap-2"
              onSubmit={e => {
                e.preventDefault()
                handleAskKnowledge()
              }}
            >
              <Input
                value={knowledgeDraft}
                onChange={e => setKnowledgeDraft(e.target.value)}
                placeholder="Ex: qu'est-ce que le cash drag ?"
                className="min-h-11 flex-1"
                disabled={knowledgeAnswerMutation.isPending}
              />
              <Button type="submit" disabled={knowledgeAnswerMutation.isPending || !knowledgeDraft.trim()}>
                Chercher
              </Button>
            </form>

            {knowledgeAnswerMutation.data && (
              <div className="mt-4 space-y-3 rounded-xl border border-border/40 bg-background/60 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{knowledgeAnswerMutation.data.status}</Badge>
                  <Badge variant="secondary">
                    {Math.round(knowledgeAnswerMutation.data.confidenceScore * 100)}%
                  </Badge>
                </div>
                {knowledgeAnswerMutation.data.answer && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{knowledgeAnswerMutation.data.answer.headline}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{knowledgeAnswerMutation.data.answer.summary}</p>
                    {knowledgeAnswerMutation.data.answer.keyPoints.length > 0 && (
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {knowledgeAnswerMutation.data.answer.keyPoints.map(kp => (
                          <li key={kp} className="flex gap-2"><span className="text-primary">-</span>{kp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {knowledgeAnswerMutation.data.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {knowledgeAnswerMutation.data.citations.map(cit => (
                      <span
                        key={cit.citationId}
                        className="rounded bg-surface-1 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {cit.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {knowledgeAnswerMutation.error && (
              <p className="mt-2 text-xs text-negative">
                {toErrorMessage(knowledgeAnswerMutation.error)}
              </p>
            )}
          </Panel>

          {/* Knowledge topics */}
          <Panel title="Sujets du knowledge pack" tone="plain" icon={<span aria-hidden="true">::</span>}>
            {knowledgeTopicsQuery.data?.topics.length ? (
              <div className="space-y-1">
                {knowledgeTopicsQuery.data.topics.slice(0, 10).map(topic => (
                  <button
                    key={topic.topicId}
                    type="button"
                    onClick={() => handleAskKnowledge(topic.title)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-1"
                  >
                    <span className="text-primary/60" aria-hidden="true">·</span>
                    <span className="text-foreground/75">{topic.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Aucun sujet disponible.</p>
            )}
          </Panel>
        </div>
      </div>
      <Panel
        title="Décision réelle"
        description="Le chat peut aider à formuler un raisonnement, mais il ne décide pas à ta place."
        icon={<span aria-hidden="true">!</span>}
        tone="warning"
        actions={
          <Link to="/ia" className="text-xs text-primary hover:underline">
            Retour synthèse
          </Link>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Avant d'agir, vérifie ton objectif, ton horizon, ton épargne de précaution,
          ta tolérance au risque et la fraîcheur des données. Aucune réponse ne prépare
          un ordre, un transfert ou un rééquilibrage automatique.
        </p>
      </Panel>
    </div>
  )
}

function ChatPrinciple({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/45 bg-surface-1/45 px-3 py-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}
