import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { CommentPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  AdvisorChatComposer,
  type AdvisorChatSendNotice,
} from '@/components/advisor/advisor-chat-composer'
import {
  AdvisorChatMessage,
  ChatResponsePending,
  UserMessage,
} from '@/components/advisor/advisor-chat-message'
import { ADVISOR_CHAT_EMPTY_SUGGESTIONS } from '@/features/advisor-chat-view-model'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { postDashboardAdvisorChat } from '@/features/dashboard-api'
import {
  dashboardAdvisorChatQueryOptionsWithMode,
  dashboardAdvisorQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

const advisorThreadKey = 'default'

type SendVariables = {
  message: string
  knownMessageIds: ReadonlySet<number>
}

export const Route = createFileRoute('/_app/ia/chat')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const flags = getAiAdvisorUiFlags()
    const visible = flags.enabled && (!flags.adminOnly || mode === 'admin')
    if (!visible) return

    await Promise.allSettled([
      context.queryClient.ensureQueryData(
        dashboardAdvisorQueryOptionsWithMode({ mode, range: '30d' })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorChatQueryOptionsWithMode({ mode, threadKey: advisorThreadKey })
      ),
    ])
  },
  component: IaChatPage,
})

const visuallyHidden = css({ srOnly: true })

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const conversationStack = css({ spaceY: '8', sm: { spaceY: '10' } })

const chatShell = css({
  mx: 'auto',
  display: 'flex',
  h: 'calc(100dvh - 9.75rem)',
  minH: '32rem',
  w: 'full',
  maxW: '780px',
  flexDirection: 'column',
  overflow: 'hidden',
  lg: { h: 'calc(100dvh - 9.25rem)' },
})

const chatHeader = css({
  display: 'flex',
  h: '12',
  flexShrink: '0',
  alignItems: 'center',
  gap: '2.5',
  borderBottomWidth: '1px',
  borderColor: 'border/55',
  px: '1',
  sm: { px: '4' },
})

const chatIconTile = css({
  display: 'grid',
  boxSize: '7',
  placeItems: 'center',
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'primary/35',
  bg: 'primary/10',
  color: 'primary',
})

const suggestionButton = css({
  minH: '11',
  rounded: 'lg',
  borderWidth: '1px',
  borderColor: 'border/65',
  bg: 'card/35',
  px: '4',
  py: '2.5',
  textAlign: 'left',
  textStyle: 'sm',
  color: 'foreground',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { borderColor: 'primary/35', bg: 'primary/5' },
  _focusVisible: {
    outlineStyle: 'none',
    boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)',
  },
})

const skeletonLine = cva({
  base: {
    h: '3',
    rounded: 'sm',
    bg: 'surface.2',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    _motionReduce: { animation: 'none' },
  },
})

const SkeletonLine = styled('div', skeletonLine)

function IaChatPage() {
  const queryClient = useQueryClient()
  const prefersReducedMotion = usePrefersReducedMotion()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const flags = getAiAdvisorUiFlags()
  const visible = flags.enabled && (!flags.adminOnly || isAdmin)
  const modeOptions = visible && authMode ? { mode: authMode } : {}
  const chatOptions = dashboardAdvisorChatQueryOptionsWithMode({
    ...modeOptions,
    threadKey: advisorThreadKey,
  })

  const [draft, setDraft] = useState('')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [sendNotice, setSendNotice] = useState<AdvisorChatSendNotice | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const shouldFollowConversationRef = useRef(true)

  const chatQuery = useQuery({
    ...chatOptions,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })
  const overviewQuery = useQuery(
    dashboardAdvisorQueryOptionsWithMode({ ...modeOptions, range: '30d' })
  )
  const messages = chatQuery.data?.messages ?? []
  const canSend = isAdmin && overviewQuery.data?.chatEnabled === true

  const chatMutation = useMutation({
    mutationFn: ({ message }: SendVariables) =>
      postDashboardAdvisorChat({ threadKey: advisorThreadKey, message }),
    retry: false,
    onSuccess: (result, variables) => {
      queryClient.setQueryData(chatOptions.queryKey, result.thread)
      setDraft(current => (current.trim() === variables.message ? '' : current))
      setPendingMessage(null)
      setSendNotice(null)
    },
    onError: async (_error, variables) => {
      setPendingMessage(null)

      if (!authMode) {
        setSendNotice({
          tone: 'warning',
          message: 'Envoi non confirmé. Vérifiez la conversation avant de renvoyer.',
        })
        return
      }

      try {
        const refreshed = await queryClient.fetchQuery({
          ...dashboardAdvisorChatQueryOptionsWithMode({
            mode: authMode,
            threadKey: advisorThreadKey,
          }),
          staleTime: 0,
        })
        const recovered = refreshed.messages.some(
          message =>
            message.role === 'user' &&
            !variables.knownMessageIds.has(message.id) &&
            message.content.trim() === variables.message
        )

        if (recovered) {
          setDraft(current => (current.trim() === variables.message ? '' : current))
          setSendNotice({
            tone: 'neutral',
            message: 'Message retrouvé dans la conversation.',
          })
          return
        }
      } catch {
        // The draft stays intact when reconciliation is unavailable.
      }

      setSendNotice({
        tone: 'warning',
        message: 'Envoi non confirmé. Vérifiez la conversation avant de renvoyer.',
      })
    },
  })

  useEffect(() => {
    void draft
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [draft])

  const conversationVersion = `${messages.length}:${pendingMessage ?? ''}`

  useEffect(() => {
    void conversationVersion
    if (!shouldFollowConversationRef.current) return
    conversationEndRef.current?.scrollIntoView({
      block: 'end',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [conversationVersion, prefersReducedMotion])

  const sendMessage = () => {
    const message = draft.trim()
    if (!message || !canSend || chatMutation.isPending) return

    shouldFollowConversationRef.current = true
    setPendingMessage(message)
    setSendNotice(null)
    chatMutation.reset()
    chatMutation.mutate({
      message,
      knownMessageIds: new Set(messages.map(item => item.id)),
    })
  }

  const handleConversationScroll = () => {
    const region = scrollRegionRef.current
    if (!region) return
    const remaining = region.scrollHeight - region.scrollTop - region.clientHeight
    shouldFollowConversationRef.current = remaining < 96
  }

  const selectSuggestion = (suggestion: string) => {
    setDraft(suggestion)
    setSendNotice(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  if (!visible) {
    return (
      <ChatShell>
        <ChatEmptyState
          title="Chat indisponible"
          description="Advisor n’est pas disponible dans cette session."
        />
      </ChatShell>
    )
  }

  const isInitialLoading = chatQuery.isPending && messages.length === 0
  const isUnavailable = chatQuery.isError && messages.length === 0

  return (
    <ChatShell>
      <styled.div
        ref={scrollRegionRef}
        onScroll={handleConversationScroll}
        minH="0"
        flex="1"
        overflowY="auto"
        overscrollBehavior="contain"
        px="1"
        py="5"
        sm={{ px: '4', py: '7' }}
      >
        {isInitialLoading ? <ChatLoadingState /> : null}

        {isUnavailable ? (
          <ChatEmptyState
            title="Conversation indisponible"
            description="Réessayez dans quelques instants. Votre brouillon reste local."
          />
        ) : null}

        {!isInitialLoading && !isUnavailable && messages.length === 0 && !pendingMessage ? (
          <ChatEmptyState
            title={canSend ? 'Que voulez-vous savoir ?' : 'Conversation en lecture seule'}
            {...(!canSend
              ? {
                  description: isDemo
                    ? 'Le chat ne crée aucun message dans la démonstration.'
                    : 'L’envoi de messages est désactivé pour cette session.',
                }
              : {})}
            {...(canSend
              ? {
                  suggestions: ADVISOR_CHAT_EMPTY_SUGGESTIONS,
                  onSelectSuggestion: selectSuggestion,
                }
              : {})}
          />
        ) : null}

        {messages.length > 0 ? (
          <ol aria-label="Conversation" className={conversationStack}>
            {messages.map(message => (
              <li key={message.id}>
                <AdvisorChatMessage message={message} />
              </li>
            ))}
            {pendingMessage ? (
              <li className={conversationStack}>
                <UserMessage content={pendingMessage} pending />
                <ChatResponsePending />
              </li>
            ) : null}
          </ol>
        ) : pendingMessage ? (
          <div className={conversationStack}>
            <UserMessage content={pendingMessage} pending />
            <ChatResponsePending />
          </div>
        ) : null}
        <div ref={conversationEndRef} aria-hidden="true" />
      </styled.div>

      <AdvisorChatComposer
        ref={textareaRef}
        value={draft}
        canSend={canSend}
        sending={chatMutation.isPending}
        notice={sendNotice}
        onChange={value => {
          setDraft(value)
          setSendNotice(null)
        }}
        onSend={sendMessage}
      />
    </ChatShell>
  )
}

function ChatShell({ children }: { children: ReactNode }) {
  return (
    <section className={chatShell}>
      <header className={chatHeader}>
        <span className={chatIconTile}>
          <CommentPixelIcon size={13} aria-hidden="true" />
        </span>
        <styled.h1 fontSize="15px" fontWeight="semibold" letterSpacing="tight" color="foreground">
          Chat
        </styled.h1>
      </header>
      {children}
    </section>
  )
}

function ChatEmptyState({
  title,
  description,
  suggestions,
  onSelectSuggestion,
}: {
  title: string
  description?: string
  suggestions?: readonly string[]
  onSelectSuggestion?: (suggestion: string) => void
}) {
  return (
    <styled.div
      display="flex"
      minH="full"
      flexDirection="column"
      justifyContent="flex-end"
      pb="6"
      sm={{ pb: '10' }}
    >
      <styled.div mx="auto" w="full" maxW="520px">
        <styled.h2
          textAlign="center"
          textStyle="xl"
          fontWeight="semibold"
          letterSpacing="tight"
          color="foreground"
          sm={{ textStyle: '2xl' }}
        >
          {title}
        </styled.h2>
        {description ? (
          <styled.p
            mx="auto"
            mt="2"
            maxW="md"
            textAlign="center"
            textStyle="sm"
            lineHeight="relaxed"
            color="muted.foreground"
          >
            {description}
          </styled.p>
        ) : null}
        {suggestions?.length && onSelectSuggestion ? (
          <styled.fieldset mt="6" display="grid" gap="2">
            <legend className={visuallyHidden}>Questions suggérées</legend>
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
                className={suggestionButton}
              >
                {suggestion}
              </button>
            ))}
          </styled.fieldset>
        ) : null}
      </styled.div>
    </styled.div>
  )
}

function ChatLoadingState() {
  return (
    <styled.output display="flex" minH="full" alignItems="center" aria-live="polite">
      <styled.div w="full" maxW="560px" spaceY="4">
        <p className={eyebrow}>Réponse en cours</p>
        <styled.div spaceY="3" aria-hidden="true">
          <SkeletonLine w="2/5" />
          <SkeletonLine w="4/5" />
          <SkeletonLine w="3/5" />
        </styled.div>
      </styled.div>
    </styled.output>
  )
}
