// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdvisorGraphNodeKind } from '@/features/advisor-graph-data'
import { DEFAULT_KNOWLEDGE_GRAPH_PALETTE, type RuntimeGraphData } from './knowledge-graph-3d-model'
import { createKnowledgeGraphRuntime } from './knowledge-graph-3d-runtime'

const forceGraphMocks = vi.hoisted(() => ({
  construct: vi.fn(),
}))

vi.mock('3d-force-graph', () => ({
  default: forceGraphMocks.construct,
}))

function createEngineHarness() {
  const engine: Record<string, unknown> = {}
  const renderer = {
    domElement: document.createElement('canvas'),
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
  }
  const chainMethods = [
    'backgroundColor',
    'showNavInfo',
    'enableNodeDrag',
    'enablePointerInteraction',
    'showPointerCursor',
    'nodeId',
    'nodeThreeObject',
    'nodeThreeObjectExtend',
    'nodeLabel',
    'linkLabel',
    'linkColor',
    'linkWidth',
    'linkOpacity',
    'linkCurvature',
    'linkDirectionalArrowLength',
    'linkDirectionalArrowRelPos',
    'linkDirectionalArrowColor',
    'linkDirectionalParticles',
    'linkDirectionalParticleSpeed',
    'linkDirectionalParticleWidth',
    'linkDirectionalParticleColor',
    'onNodeHover',
    'onLinkHover',
    'onNodeClick',
    'onLinkClick',
    'onBackgroundClick',
    'warmupTicks',
    'cooldownTicks',
    'linkDirectionalArrowResolution',
    'linkDirectionalParticleResolution',
    'graphData',
    'refresh',
    'pauseAnimation',
    'resumeAnimation',
    'd3ReheatSimulation',
  ] as const
  for (const method of chainMethods) engine[method] = vi.fn(() => engine)

  let width = 0
  let height = 0
  let engineStop = () => {}
  const cameraPosition = vi.fn((position?: unknown) =>
    position === undefined ? { x: 0, y: 0, z: 360 } : engine
  )
  const zoomToFit = vi.fn(() => engine)
  const destructor = vi.fn()
  engine.renderer = vi.fn(() => renderer)
  engine.width = vi.fn((value?: number) => {
    if (value === undefined) return width
    width = value
    return engine
  })
  engine.height = vi.fn((value?: number) => {
    if (value === undefined) return height
    height = value
    return engine
  })
  engine.cameraPosition = cameraPosition
  engine.zoomToFit = zoomToFit
  engine.onEngineStop = vi.fn((callback: () => void) => {
    engineStop = callback
    return engine
  })
  engine._destructor = destructor

  return {
    engine,
    cameraPosition,
    zoomToFit,
    destructor,
    triggerEngineStop: () => engineStop(),
  }
}

describe('KnowledgeGraphRuntime lifecycle boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues pre-layout focus, consumes it before initial fit, and destroys the owned engine', () => {
    const harness = createEngineHarness()
    // A regular function on purpose: the runtime calls `new ForceGraph3D(...)` and Vitest rejects arrow functions for constructed mocks
    forceGraphMocks.construct.mockImplementationOnce(function () {
      return harness.engine
    })
    const graph: RuntimeGraphData = {
      nodes: [{ id: 'goal:reserve', label: 'R\u00e9serve', kind: 'goal' }],
      links: [],
    }
    const runtime = createKnowledgeGraphRuntime(document.createElement('div'), {
      onSelectNode: vi.fn(),
      onSelectLink: vi.fn(),
      onError: vi.fn(),
    })

    runtime.update({
      graph,
      selectedNodeId: null,
      highlightedNodeIds: new Set<string>(),
      pathLinkKeys: new Set<string>(),
      pathNodeIds: new Set<string>(),
      pinnedNodeIds: new Set<string>(),
      emphasizedKinds: new Set<AdvisorGraphNodeKind>(),
      preset: 'standard',
      autoOrbit: false,
      reducedMotion: false,
      paused: false,
      mobile: false,
      width: 800,
      height: 560,
      devicePixelRatio: 1,
      palette: DEFAULT_KNOWLEDGE_GRAPH_PALETTE,
    })
    harness.cameraPosition.mockClear()

    runtime.focusNode('goal:reserve')
    expect(harness.cameraPosition).not.toHaveBeenCalled()

    const node = graph.nodes[0]
    if (!node) throw new Error('Fixture runtime graph is incomplete')
    Object.assign(node, { x: 10, y: 0, z: 0 })
    harness.triggerEngineStop()

    expect(harness.zoomToFit).not.toHaveBeenCalled()
    expect(harness.cameraPosition).toHaveBeenCalledWith(
      { x: 96, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      460
    )

    runtime.destroy()
    expect(harness.destructor).toHaveBeenCalledTimes(1)
  })
})
