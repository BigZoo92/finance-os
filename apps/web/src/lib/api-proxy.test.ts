import { describe, expect, it } from 'vitest'
import {
  buildDownstreamHeaders,
  buildUpstreamHeaders,
  buildUpstreamUrl,
  proxyApiRequest,
  resolveInternalApiBaseUrl,
} from './api-proxy'

describe('resolveInternalApiBaseUrl', () => {
  it('reads API_INTERNAL_URL at call time and strips trailing slashes', () => {
    expect(resolveInternalApiBaseUrl({ API_INTERNAL_URL: 'http://api:3001/' })).toBe(
      'http://api:3001'
    )
    expect(resolveInternalApiBaseUrl({ API_INTERNAL_URL: '  ' })).toBe('http://127.0.0.1:3001')
    expect(resolveInternalApiBaseUrl({})).toBe('http://127.0.0.1:3001')
  })
})

describe('buildUpstreamUrl', () => {
  it('maps the /api splat onto the internal API root and keeps the query string', () => {
    expect(
      buildUpstreamUrl({
        baseUrl: 'http://api:3001',
        splat: 'dashboard/summary',
        search: '?range=30d',
      })
    ).toBe('http://api:3001/dashboard/summary?range=30d')
    expect(buildUpstreamUrl({ baseUrl: 'http://api:3001', splat: undefined, search: '' })).toBe(
      'http://api:3001/'
    )
  })
})

describe('header translation', () => {
  it('drops hop-by-hop headers upstream and keeps cookies and request ids', () => {
    const headers = buildUpstreamHeaders(
      new Headers({
        host: 'finance-os.local',
        connection: 'keep-alive',
        cookie: 'finance_os_session=abc',
        'x-request-id': 'req-1',
        'content-type': 'application/json',
      })
    )
    expect(headers.get('host')).toBeNull()
    expect(headers.get('connection')).toBeNull()
    expect(headers.get('cookie')).toBe('finance_os_session=abc')
    expect(headers.get('x-request-id')).toBe('req-1')
  })

  it('forwards every Set-Cookie header and drops encoding headers of the decoded body', () => {
    const upstream = new Headers({
      'content-type': 'application/json',
      'content-encoding': 'br',
      'content-length': '12',
      'cache-control': 'no-store',
    })
    upstream.append('set-cookie', 'a=1; Path=/; HttpOnly')
    upstream.append('set-cookie', 'b=2; Path=/; Secure')

    const headers = buildDownstreamHeaders(upstream, 'req-2')
    expect(headers.getSetCookie()).toEqual(['a=1; Path=/; HttpOnly', 'b=2; Path=/; Secure'])
    expect(headers.get('content-encoding')).toBeNull()
    expect(headers.get('content-length')).toBeNull()
    expect(headers.get('cache-control')).toBe('no-store')
    expect(headers.get('x-request-id')).toBe('req-2')
  })
})

describe('proxyApiRequest', () => {
  it('forwards method, path, query, headers and body to the runtime-resolved API', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const request = new Request('http://web.local/api/dashboard/goals?range=7d', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 's=1', 'x-request-id': 'req-3' },
      body: JSON.stringify({ name: 'Épargne' }),
    })

    const response = await proxyApiRequest({
      request,
      splat: 'dashboard/goals',
      baseUrl: 'http://api:3001',
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        const body = await new Response(init.body as BodyInit).text()
        return Response.json(
          { ok: true, echo: JSON.parse(body) },
          { status: 201, headers: { 'x-request-id': 'req-3' } }
        )
      },
    })

    expect(calls[0]?.url).toBe('http://api:3001/dashboard/goals?range=7d')
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.redirect).toBe('manual')
    expect(new Headers(calls[0]?.init.headers).get('cookie')).toBe('s=1')
    expect(new Headers(calls[0]?.init.headers).get('x-request-id')).toBe('req-3')
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true, echo: { name: 'Épargne' } })
  })

  it('assigns a request id when the browser did not send one', async () => {
    let forwarded: string | null = null
    const response = await proxyApiRequest({
      request: new Request('http://web.local/api/auth/me'),
      splat: 'auth/me',
      baseUrl: 'http://api:3001',
      fetchImpl: async (_url, init) => {
        forwarded = new Headers(init.headers).get('x-request-id')
        return Response.json({ mode: 'demo' })
      },
    })
    expect(forwarded).toBeTruthy()
    expect(response.headers.get('x-request-id')).toBe(forwarded)
  })

  it('answers 502 with a safe envelope when the API is unreachable', async () => {
    const response = await proxyApiRequest({
      request: new Request('http://web.local/api/health', { headers: { 'x-request-id': 'req-4' } }),
      splat: 'health',
      baseUrl: 'http://api:3001',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED')
      },
    })
    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      ok: false,
      code: 'API_UNAVAILABLE',
      message: 'Internal API unavailable',
      requestId: 'req-4',
    })
  })
})
