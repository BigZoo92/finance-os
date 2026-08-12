/**
 * StatusDot — live/ok/warn/err/idle indicator with optional pulse.
 *
 * Converged with the canonical Status family (flat semantic dots, no
 * glow). Prefer `Status` from `@finance-os/ui/components` when a visible
 * label accompanies the dot; StatusDot remains for compact compositions.
 */
type Tone = 'ok' | 'warn' | 'err' | 'idle' | 'live' | 'brand' | 'violet'

const DOT: Record<Tone, string> = {
  ok: 'bg-positive',
  warn: 'bg-warning',
  err: 'bg-negative',
  idle: 'bg-muted-foreground/60',
  live: 'bg-primary',
  brand: 'bg-primary',
  violet: 'bg-accent-2',
}

type StatusDotProps = {
  tone?: Tone
  pulse?: boolean
  size?: number
  className?: string
  label?: string
}

export function StatusDot({
  tone = 'idle',
  pulse = false,
  size = 8,
  className = '',
  label,
}: StatusDotProps) {
  return (
    <span
      {...(label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': 'true' as const })}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span className={`absolute inset-0 rounded-full ${DOT[tone]}`} />
      {pulse && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-full ${DOT[tone]} animate-ping opacity-60`}
        />
      )}
    </span>
  )
}

export default StatusDot
