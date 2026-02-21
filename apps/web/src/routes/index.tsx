import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute(undefined)({
  component: HomePage,
})

type ApiHealth =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: unknown }
  | { status: 'error'; message: string }

function HomePage() {
  const [apiHealth, setApiHealth] = useState<ApiHealth>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setApiHealth({ status: 'loading' })

      try {
        const res = await fetch('http://localhost:3001/health')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = (await res.json()) as unknown

        if (!cancelled) {
          setApiHealth({ status: 'ok', data })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!cancelled) {
          setApiHealth({ status: 'error', message })
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <h1>Finance OS</h1>
      <p>Web app OK ✅</p>

      <h2>API health</h2>
      <Button></Button>
      <pre>{JSON.stringify(apiHealth, null, 2)}</pre>
    </main>
  )
}
