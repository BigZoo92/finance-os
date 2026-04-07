/**
 * ASCII art identity system for Finance-OS.
 * Distinctive visual accent — never the core UI, always a character layer.
 */

const ASCII_LOGO = `
 ╔═══════════════╗
 ║  FINANCE  OS  ║
 ╚═══════════════╝`

const ASCII_DIVIDER_THIN = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─'
const ASCII_DIVIDER_BOLD = '═══════════════════════════'
const ASCII_CORNER_TL = '┌'
const ASCII_CORNER_TR = '┐'
const ASCII_CORNER_BL = '└'
const ASCII_CORNER_BR = '┘'

const SECTION_GLYPHS: Record<string, string> = {
  cockpit:         '◈',
  depenses:        '↔',
  patrimoine:      '◆',
  investissements: '△',
  objectifs:       '◎',
  actualites:      '▣',
  integrations:    '⊞',
  parametres:      '⚙',
  sante:           '♡',
  positive:        '▲',
  negative:        '▼',
  neutral:         '●',
  sync:            '⟳',
  alert:           '⚡',
  check:           '✓',
  cross:           '✗',
}

export function AsciiLogo({ className }: { className?: string }) {
  return (
    <pre
      className={`font-mono text-xs leading-tight text-primary/70 select-none ${className ?? ''}`}
      aria-hidden="true"
    >
      {ASCII_LOGO.trim()}
    </pre>
  )
}

export function AsciiDivider({ variant = 'thin', className }: { variant?: 'thin' | 'bold'; className?: string }) {
  return (
    <div
      className={`font-mono text-xs text-border/60 select-none overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      {variant === 'bold' ? ASCII_DIVIDER_BOLD : ASCII_DIVIDER_THIN}
    </div>
  )
}

export function AsciiFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <span className="absolute -top-2 -left-1 font-mono text-xs text-primary/30 select-none" aria-hidden="true">{ASCII_CORNER_TL}</span>
      <span className="absolute -top-2 -right-1 font-mono text-xs text-primary/30 select-none" aria-hidden="true">{ASCII_CORNER_TR}</span>
      <span className="absolute -bottom-2 -left-1 font-mono text-xs text-primary/30 select-none" aria-hidden="true">{ASCII_CORNER_BL}</span>
      <span className="absolute -bottom-2 -right-1 font-mono text-xs text-primary/30 select-none" aria-hidden="true">{ASCII_CORNER_BR}</span>
      {children}
    </div>
  )
}

export function SectionGlyph({ section, className }: { section: keyof typeof SECTION_GLYPHS; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center text-base leading-none ${className ?? ''}`} aria-hidden="true">
      {SECTION_GLYPHS[section] ?? '●'}
    </span>
  )
}

export function AsciiStatusLine({ items }: { items: Array<{ label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' }> }) {
  return (
    <div className="font-mono text-xs text-muted-foreground/70 flex flex-wrap gap-x-4 gap-y-1 select-none" aria-hidden="true">
      {items.map(item => (
        <span key={item.label}>
          <span className="text-muted-foreground/40">[</span>
          <span>{item.label}</span>
          <span className="text-muted-foreground/40">:</span>
          <span className={
            item.tone === 'positive' ? 'text-positive' :
            item.tone === 'negative' ? 'text-negative' :
            'text-foreground/70'
          }>{item.value}</span>
          <span className="text-muted-foreground/40">]</span>
        </span>
      ))}
    </div>
  )
}

export { SECTION_GLYPHS, ASCII_DIVIDER_THIN, ASCII_DIVIDER_BOLD }
