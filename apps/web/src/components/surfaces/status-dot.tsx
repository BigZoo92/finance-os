/**
 * StatusDot — canonical live/ok/warn/err/idle indicator with optional pulse.
 */
type Tone = 'ok' | 'warn' | 'err' | 'idle' | 'live' | 'brand' | 'violet'

const DOT: Record<Tone, string> = {
  ok: 'bg-positive shadow-[0_0_8px_oklch(from_var(--positive)_l_c_h/55%)]',
  warn: 'bg-warning shadow-[0_0_8px_oklch(from_var(--warning)_l_c_h/55%)]',
  err: 'bg-negative shadow-[0_0_8px_oklch(from_var(--negative)_l_c_h/55%)]',
  idle: 'bg-muted-foreground/60',
  live: 'bg-primary shadow-[0_0_10px_oklch(from_var(--primary)_l_c_h/60%)]',
  brand: 'bg-primary shadow-[0_0_10px_oklch(from_var(--primary)_l_c_h/60%)]',
  violet: 'bg-accent-2 shadow-[0_0_10px_oklch(from_var(--accent-2)_l_c_h/60%)]',
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
