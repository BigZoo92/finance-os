#!/usr/bin/env node
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const host = process.env.E2E_DEMO_API_HOST ?? '127.0.0.1'
const port = Number(process.env.E2E_DEMO_API_PORT ?? 3001)

const toJsonResponse = (response, status, payload, requestId) => {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-request-id': requestId,
  })
  response.end(JSON.stringify(payload))
}

const normalizePath = pathname => {
  if (pathname === '/api') {
    return '/'
  }

  return pathname.startsWith('/api/') ? pathname.slice(4) : pathname
}

const server = createServer((request, response) => {
  const requestId = request.headers['x-request-id']?.toString() || randomUUID()
  const url = new URL(request.url ?? '/', `http://${host}:${port}`)
  const pathname = normalizePath(url.pathname)

  if (request.method === 'GET' && pathname === '/health') {
    toJsonResponse(
      response,
      200,
      {
        ok: true,
        service: 'finance-os-e2e-demo-api',
        mode: 'demo',
        requestId,
      },
      requestId
    )
    return
  }

  if (request.method === 'GET' && pathname === '/auth/me') {
    toJsonResponse(
      response,
      200,
      {
        mode: 'demo',
        user: null,
        requestId,
      },
      requestId
    )
    return
  }

  if (request.method === 'GET' && pathname === '/dashboard/trading-lab/attention') {
    toJsonResponse(
      response,
      200,
      {
        ok: true,
        items: [],
        openCount: 0,
        requestId,
      },
      requestId
    )
    return
  }

  toJsonResponse(
    response,
    404,
    {
      ok: false,
      code: 'E2E_ROUTE_NOT_FOUND',
      message: 'Route not implemented by the deterministic E2E demo API.',
      requestId,
    },
    requestId
  )
})

server.listen(port, host, () => {
  console.log(`E2E demo API listening on http://${host}:${port}`)
})
