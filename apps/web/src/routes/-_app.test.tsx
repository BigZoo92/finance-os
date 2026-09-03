// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { usePrefersReducedMotionMock } = vi.hoisted(() => ({
  usePrefersReducedMotionMock: vi.fn<() => boolean>(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => <p>Contenu</p>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/ia/memoire' } }),
}))

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({
      initial,
      exit,
      children,
      ...props
    }: ComponentProps<'div'> & { initial?: unknown; exit?: unknown }) => (
      <div
        data-initial={JSON.stringify(initial)}
        {...(exit === undefined ? {} : { 'data-exit': JSON.stringify(exit) })}
        {...props}
      >
        {children}
      </div>
    ),
  },
}))

vi.mock('@/components/shell/command-palette', () => ({ CommandPalette: () => null }))
vi.mock('@/components/shell/mobile-nav', () => ({
  MobileNav: () => null,
  MobileTopBar: () => null,
}))
vi.mock('@/components/shell/top-navbar', () => ({ TopNavbar: () => null }))
vi.mock('@/lib/use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: usePrefersReducedMotionMock,
}))

import { AppLayout } from './_app'

afterEach(() => {
  cleanup()
  usePrefersReducedMotionMock.mockReset()
})

describe('AppLayout route transition', () => {
  it('uses the hydration-safe reduced-motion state to remove route entrance and exit motion', () => {
    usePrefersReducedMotionMock.mockReturnValue(true)

    render(<AppLayout />)

    const content = screen.getByText('Contenu').parentElement
    expect(usePrefersReducedMotionMock).toHaveBeenCalledOnce()
    expect(content?.getAttribute('data-initial')).toBe('false')
    expect(content?.hasAttribute('data-exit')).toBe(false)
  })

  it('keeps the canonical short route transition when motion is allowed', () => {
    usePrefersReducedMotionMock.mockReturnValue(false)

    render(<AppLayout />)

    const content = screen.getByText('Contenu').parentElement
    expect(content?.getAttribute('data-initial')).toBe('{"opacity":0,"y":8}')
    expect(content?.getAttribute('data-exit')).toBe('{"opacity":0,"y":-4}')
  })
})
