import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

/**
 * Development-only panel. The root route imports this module lazily behind
 * `import.meta.env.PROD`, so none of the devtools packages reach the
 * production client or server bundles.
 */
export default function AppDevtools() {
  return (
    <TanStackDevtools
      config={{ position: 'bottom-right' }}
      plugins={[
        { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
        { name: 'Tanstack Query', render: <ReactQueryDevtoolsPanel /> },
      ]}
    />
  )
}
