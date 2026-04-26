import type { NewsProviderAdapter } from '../news-provider-types'
import { fetchJson, sanitizePayload, trimOrNull } from '../news-provider-utils'

interface BlueskyAuthorFeedResponse {
  feed?: Array<{
    post?: {
      uri?: string
      cid?: string
      author?: {
        did?: string
        handle?: string
        displayName?: string
      }
      record?: {
        text?: string
        createdAt?: string
        langs?: string[]
      }
      indexedAt?: string
    }
  }>
  cursor?: string
}

// Simple in-memory session cache to avoid creating a new session per fetch.
// Invalidated after 10 minutes or on auth failure.
let cachedSession: { jwt: string; expiresAt: number } | null = null

const getOrCreateSession = async (
  serviceUrl: string,
  handle: string,
  appPassword: string,
  requestId: string
): Promise<string | null> => {
  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return cachedSession.jwt
  }

  try {
    const response = await fetch(
      `${serviceUrl}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        body: JSON.stringify({ identifier: handle, password: appPassword }),
      }
    )
    if (!response.ok) {
      cachedSession = null
      return null
    }
    const data = (await response.json()) as { accessJwt?: string }
    if (!data.accessJwt) {
      cachedSession = null
      return null
    }
    // Cache for 10 minutes
    cachedSession = { jwt: data.accessJwt, expiresAt: Date.now() + 10 * 60 * 1000 }
    return data.accessJwt
  } catch {
    cachedSession = null
    return null
  }
}

export const createBlueskyNewsProvider = ({
  enabled,
  handle,
  appPassword,
  serviceUrl,
}: {
  enabled: boolean
  handle: string | undefined
  appPassword: string | undefined
  serviceUrl: string
}): NewsProviderAdapter => ({
  provider: 'bluesky',
  enabled,
  cooldownMs: 2_000,
  async fetchItems({ requestId, maxItems }) {
    if (!handle || !appPassword) {
      return []
    }

    const accessJwt = await getOrCreateSession(serviceUrl, handle, appPassword, requestId)
    if (!accessJwt) return []

    let payload: BlueskyAuthorFeedResponse
    try {
      payload = await fetchJson<BlueskyAuthorFeedResponse>({
        url: `${serviceUrl}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=${Math.min(maxItems, 50)}`,
        requestId,
        headers: { Authorization: `Bearer ${accessJwt}` },
      })
    } catch {
      // Invalidate cached session on fetch failure (may be auth issue)
      cachedSession = null
      return []
    }

    return (payload.feed ?? [])
      .map(item => {
        const post = item.post
        if (!post) return null

        const uri = trimOrNull(post.uri)
        const text = trimOrNull(post.record?.text)
        const createdAt = post.record?.createdAt ? new Date(post.record.createdAt) : null
        if (!uri || !text || !createdAt || Number.isNaN(createdAt.getTime())) {
          return null
        }

        const authorHandle = trimOrNull(post.author?.handle) ?? handle
        const postId = uri.split('/').pop() ?? uri
        const providerUrl = `https://bsky.app/profile/${authorHandle}/post/${postId}`

        return {
          provider: 'bluesky' as const,
          providerArticleId: uri,
          providerUrl,
          canonicalUrl: providerUrl,
          sourceName: trimOrNull(post.author?.displayName) ?? authorHandle,
          sourceDomain: 'bsky.app',
          sourceType: 'social' as const,
          title: text.length > 280 ? `${text.slice(0, 277)}...` : text,
          summary: null,
          contentSnippet: text,
          language: post.record?.langs?.[0] ?? 'en',
          country: null,
          region: null,
          geoScope: 'global' as const,
          publishedAt: createdAt,
          metadata: {
            authorDid: post.author?.did,
            authorHandle,
            cid: post.cid,
          },
          rawPayload: sanitizePayload(post),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, maxItems)
  },
})
