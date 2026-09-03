// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdvisorGraph } from '@/features/advisor-graph-data'
import {
  type CameraApi,
  KnowledgeGraph3D,
  type KnowledgeGraphRenderState,
} from './knowledge-graph-3d'

const runtimeMocks = vi.hoisted(() => {
  const runtime = {
    update: vi.fn(),
    resetView: vi.fn(),
    fitView: vi.fn(),
    focusNode: vi.fn(),
    reheat: vi.fn(),
    destroy: vi.fn(),
  }
  return {
    runtime,
    create: vi.fn(() => runtime),
  }
})

vi.mock('./knowledge-graph-3d-runtime', () => ({
  createKnowledgeGraphRuntime: runtimeMocks.create,
}))

const GRAPH: AdvisorGraph = {
  nodes: [
    { id: 'goal:reserve', label: 'R\u00e9serve', kind: 'goal' },
    { id: 'risk:cash', label: 'Risque de tr\u00e9sorerie', kind: 'risk' },
  ],
  links: [{ source: 'risk:cash', target: 'goal:reserve', kind: 'affects' }],
  meta: {
    origin: 'demo',
    summary: 'Fixture',
    nodeCount: 2,
    linkCount: 1,
    realNodeCount: 0,
    exampleNodeCount: 2,
  },
}

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe() {
    this.callback(
      [{ contentRect: { width: 820, height: 560 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    )
  }

  disconnect() {}

  unobserve() {}
}

describe('KnowledgeGraph3D lifecycle boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeMocks.create.mockImplementation(() => runtimeMocks.runtime)
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('lazily creates one runtime, updates it with cloned data, exposes camera controls, and destroys it', async () => {
    const states: KnowledgeGraphRenderState[] = []
    const cameraApis: Array<CameraApi | null> = []
    const view = render(
      <KnowledgeGraph3D
        graph={GRAPH}
        selectedNodeId={null}
        onSelectNode={() => {}}
        onSelectLink={() => {}}
        highlightedNodeIds={new Set()}
        visibleNodeKinds={new Set(['goal', 'risk'])}
        visibleLinkKinds={new Set(['affects'])}
        paused={false}
        registerCameraApi={api => {
          cameraApis.push(api)
        }}
        onRenderStateChange={state => states.push(state)}
      />
    )

    await waitFor(() => expect(runtimeMocks.create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(runtimeMocks.runtime.update).toHaveBeenCalled())
    const update = runtimeMocks.runtime.update.mock.calls.at(-1)?.[0]
    expect(update?.graph.nodes[0]).not.toBe(GRAPH.nodes[0])
    expect(update?.graph.links[0]).not.toBe(GRAPH.links[0])
    expect(update?.width).toBe(820)
    expect(update?.height).toBe(560)
    expect(states).toContain('loading')
    expect(states).toContain('ready')

    await waitFor(() => expect(cameraApis.some(api => api !== null)).toBe(true))
    const cameraApi = cameraApis.find(api => api !== null)
    if (!cameraApi) throw new Error('Camera API was not registered')
    cameraApi.focusNode('goal:reserve')
    expect(runtimeMocks.runtime.focusNode).toHaveBeenCalledWith('goal:reserve')

    view.unmount()
    expect(runtimeMocks.runtime.destroy).toHaveBeenCalledTimes(1)
  })

  it('reports initialization failure and surfaces the non-WebGL fallback state', async () => {
    const initError = new Error('WebGL unavailable')
    const onRenderError = vi.fn()
    const onWebGlFailure = vi.fn()
    const onRenderStateChange = vi.fn()
    runtimeMocks.create.mockImplementationOnce(() => {
      throw initError
    })

    const view = render(
      <KnowledgeGraph3D
        graph={GRAPH}
        selectedNodeId={null}
        onSelectNode={() => {}}
        onSelectLink={() => {}}
        highlightedNodeIds={new Set()}
        visibleNodeKinds={new Set(['goal', 'risk'])}
        visibleLinkKinds={new Set(['affects'])}
        paused={false}
        onRenderError={onRenderError}
        onWebGlFailure={onWebGlFailure}
        onRenderStateChange={onRenderStateChange}
      />
    )

    await waitFor(() => expect(onRenderError).toHaveBeenCalledWith(initError))
    expect(onWebGlFailure).toHaveBeenCalledTimes(1)
    expect(onRenderStateChange).toHaveBeenLastCalledWith('error')
    expect(
      view.getByText('La vue 3D est indisponible. La m\u00e9moire reste accessible dans la liste.')
    ).toBeTruthy()
  })
})
