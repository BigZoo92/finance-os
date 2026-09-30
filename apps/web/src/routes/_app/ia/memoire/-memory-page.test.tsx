// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CameraApi } from '@/components/advisor/knowledge-graph-3d'
import type {
  AdvisorGraph,
  AdvisorGraphLink,
  AdvisorGraphNode,
} from '@/features/advisor-graph-data'
import {
  getMemoryControlsDrawerSide,
  MemoryBottomControls,
  MemoryTopControls,
  reconcileMemorySelectedLink,
  resolveMemoryViewAfterRenderState,
  selectMemorySearchResult,
  useMemoryCameraRegistration,
  useMemoryKeyboardShortcuts,
} from './index'

afterEach(cleanup)

const goalNode: AdvisorGraphNode = {
  id: 'goal:reserve',
  label: 'Réserve de sécurité',
  kind: 'goal',
}

const riskNode: AdvisorGraphNode = {
  id: 'risk:cash',
  label: 'Risque de trésorerie',
  kind: 'risk',
}

const selectedLink: AdvisorGraphLink = {
  source: riskNode.id,
  target: goalNode.id,
  kind: 'affects',
  summary: 'Le risque réduit la marge de sécurité.',
}

const graph: AdvisorGraph = {
  nodes: [goalNode, riskNode],
  links: [selectedLink],
  meta: {
    origin: 'demo',
    summary: 'Mémoire de démonstration',
    nodeCount: 2,
    linkCount: 1,
    realNodeCount: 0,
    exampleNodeCount: 2,
  },
}

function createCameraApi(): CameraApi {
  return {
    resetView: vi.fn(),
    fitView: vi.fn(),
    focusNode: vi.fn(),
    reheat: vi.fn(),
  }
}

describe('Memory fallback and visibility boundaries', () => {
  it('switches renderer failures to the accessible list and keeps the broken graph disabled', () => {
    expect(resolveMemoryViewAfterRenderState('graph', 'error')).toBe('list')
    expect(resolveMemoryViewAfterRenderState('list', 'ready')).toBe('list')
    expect(resolveMemoryViewAfterRenderState('graph', 'loading')).toBe('graph')

    render(
      <MemoryBottomControls
        view="list"
        renderState="error"
        isImmersive={false}
        originLabel="Exemples de démonstration"
        originDescription="Ces souvenirs sont fictifs."
        visibleCount={graph.nodes.length}
        pinnedIds={new Set()}
        graph={graph}
        immersiveTriggerRef={createRef<HTMLButtonElement>()}
        onSelectPin={vi.fn()}
        onClearPins={vi.fn()}
        onTracePins={vi.fn()}
        onToggleView={vi.fn()}
        onResetView={vi.fn()}
        onEnterImmersive={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Carte 3D' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Exemples de démonstration')).toBeTruthy()
  })

  it('clears a selected relation as soon as filters remove it', () => {
    const equivalentVisibleLink: AdvisorGraphLink = {
      source: selectedLink.source,
      target: selectedLink.target,
      kind: selectedLink.kind,
    }

    expect(reconcileMemorySelectedLink(selectedLink, [equivalentVisibleLink])).toBe(selectedLink)
    expect(reconcileMemorySelectedLink(selectedLink, [])).toBeNull()
    expect(
      reconcileMemorySelectedLink(selectedLink, [
        { source: selectedLink.target, target: selectedLink.source, kind: selectedLink.kind },
      ])
    ).toBeNull()
    expect(reconcileMemorySelectedLink(null, graph.links)).toBeNull()
  })
})

describe('Memory immersive and mobile chrome', () => {
  it('keeps immersive chrome minimal and provides a touch-sized exit', () => {
    const onExitImmersive = vi.fn()

    render(
      <MemoryTopControls
        lensId="atlas"
        isImmersive
        searchTerm=""
        searchOpen={false}
        searchResults={[]}
        searchInputRef={createRef<HTMLInputElement>()}
        visibleCount={graph.nodes.length}
        onSearchTermChange={vi.fn()}
        onSearchFocus={vi.fn()}
        onSearchSubmit={vi.fn()}
        onSearchSelection={vi.fn()}
        onLensChange={vi.fn()}
        onOpenControls={vi.fn()}
        onExitImmersive={onExitImmersive}
      />
    )

    expect(screen.getByRole('combobox', { name: 'Rechercher dans la mémoire' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tout' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plus' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Filtres' })).toBeNull()

    const touchExit = screen.getAllByRole('button', { name: 'Échap pour quitter' })[0]
    if (!touchExit) throw new Error('Missing immersive exit')
    expect(touchExit.className).toContain('min-h_11')
    fireEvent.click(touchExit)
    expect(onExitImmersive).toHaveBeenCalledTimes(1)
  })

  it('keeps origin and secondary controls available in the simplified mobile composition', () => {
    const onOpenControls = vi.fn()
    const onToggleView = vi.fn()

    render(
      <>
        <MemoryTopControls
          lensId="atlas"
          isImmersive={false}
          searchTerm=""
          searchOpen={false}
          searchResults={[]}
          searchInputRef={createRef<HTMLInputElement>()}
          visibleCount={graph.nodes.length}
          onSearchTermChange={vi.fn()}
          onSearchFocus={vi.fn()}
          onSearchSubmit={vi.fn()}
          onSearchSelection={vi.fn()}
          onLensChange={vi.fn()}
          onOpenControls={onOpenControls}
          onExitImmersive={vi.fn()}
        />
        <MemoryBottomControls
          view="graph"
          renderState="ready"
          isImmersive={false}
          originLabel="Exemples de démonstration"
          originDescription="Ces souvenirs sont fictifs."
          visibleCount={graph.nodes.length}
          pinnedIds={new Set()}
          graph={graph}
          immersiveTriggerRef={createRef<HTMLButtonElement>()}
          onSelectPin={vi.fn()}
          onClearPins={vi.fn()}
          onTracePins={vi.fn()}
          onToggleView={onToggleView}
          onResetView={vi.fn()}
          onEnterImmersive={vi.fn()}
        />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    expect(onOpenControls).toHaveBeenCalledTimes(1)
    expect(getMemoryControlsDrawerSide(true)).toBe('bottom')
    expect(getMemoryControlsDrawerSide(false)).toBe('right')

    const originLabel = screen.getByText('Exemples de démonstration')
    expect(originLabel.className).not.toContain('d_none')
    expect(originLabel.parentElement?.getAttribute('title')).toBe('Ces souvenirs sont fictifs.')
    expect(screen.getByText('2 souvenirs')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Liste' }))
    expect(onToggleView).toHaveBeenCalledTimes(1)
  })
})

type RegisterCameraApi = (api: CameraApi | null) => void

function CameraRegistrationHarness({
  selectedNodeId,
  onRegistration,
}: {
  selectedNodeId: string | null
  onRegistration: (registerCameraApi: RegisterCameraApi) => void
}) {
  const { registerCameraApi } = useMemoryCameraRegistration(selectedNodeId)

  useEffect(() => {
    onRegistration(registerCameraApi)
  }, [onRegistration, registerCameraApi])

  return null
}

function KeyboardHarness({
  isImmersive,
  searchOpen,
  onExitImmersive,
  onSearchOpenChange,
}: {
  isImmersive: boolean
  searchOpen: boolean
  onExitImmersive: () => void
  onSearchOpenChange: (open: boolean) => void
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  useMemoryKeyboardShortcuts({
    isImmersive,
    searchOpen,
    searchInputRef,
    onExitImmersive,
    onSearchOpenChange,
  })

  return <input ref={searchInputRef} aria-label="Recherche test" />
}

describe('Memory camera and keyboard boundaries', () => {
  it('keeps camera registration stable and focuses the pending initial selection', () => {
    const registrations: RegisterCameraApi[] = []
    const onRegistration = vi.fn((registration: RegisterCameraApi) => {
      registrations.push(registration)
    })
    const view = render(
      <CameraRegistrationHarness selectedNodeId={goalNode.id} onRegistration={onRegistration} />
    )

    const registration = registrations[0]
    if (!registration) throw new Error('Missing camera registration')
    const initialCamera = createCameraApi()
    registration(initialCamera)
    expect(initialCamera.focusNode).toHaveBeenCalledWith(goalNode.id)

    view.rerender(
      <CameraRegistrationHarness selectedNodeId={riskNode.id} onRegistration={onRegistration} />
    )
    expect(onRegistration).toHaveBeenCalledTimes(1)

    const replacementCamera = createCameraApi()
    registration(replacementCamera)
    expect(replacementCamera.focusNode).toHaveBeenCalledWith(riskNode.id)
  })

  it('prioritizes Escape exit and keeps slash search focus out of editable fields', () => {
    const onExitImmersive = vi.fn()
    const onSearchOpenChange = vi.fn()
    const view = render(
      <KeyboardHarness
        isImmersive
        searchOpen
        onExitImmersive={onExitImmersive}
        onSearchOpenChange={onSearchOpenChange}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExitImmersive).toHaveBeenCalledTimes(1)
    expect(onSearchOpenChange).not.toHaveBeenCalled()

    view.rerender(
      <KeyboardHarness
        isImmersive={false}
        searchOpen
        onExitImmersive={onExitImmersive}
        onSearchOpenChange={onSearchOpenChange}
      />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onSearchOpenChange).toHaveBeenLastCalledWith(false)

    view.rerender(
      <KeyboardHarness
        isImmersive={false}
        searchOpen={false}
        onExitImmersive={onExitImmersive}
        onSearchOpenChange={onSearchOpenChange}
      />
    )
    const input = screen.getByRole('textbox', { name: 'Recherche test' })
    input.blur()
    onSearchOpenChange.mockClear()
    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(input)
    expect(onSearchOpenChange).toHaveBeenCalledWith(true)

    onSearchOpenChange.mockClear()
    fireEvent.keyDown(input, { key: '/' })
    expect(onSearchOpenChange).not.toHaveBeenCalled()
  })

  it('selects a search result, focuses it when the camera is ready, and always closes search', () => {
    const cameraApi = createCameraApi()
    const calls: string[] = []

    selectMemorySearchResult({
      node: goalNode,
      cameraApi,
      onSelectNode: id => calls.push(`select:${id}`),
      onCloseSearch: () => calls.push('close'),
    })

    expect(cameraApi.focusNode).toHaveBeenCalledWith(goalNode.id)
    expect(calls).toEqual([`select:${goalNode.id}`, 'close'])

    selectMemorySearchResult({
      node: riskNode,
      cameraApi: null,
      onSelectNode: id => calls.push(`select:${id}`),
      onCloseSearch: () => calls.push('close'),
    })
    expect(calls.slice(-2)).toEqual([`select:${riskNode.id}`, 'close'])
  })
})
