/**
 * CockpitHero — signature Aurora Pink hero for the `/` cockpit route.
 *
 * Layers (back → front):
 *   1. LiquidEther WebGL canvas (via AuroraCanvas) — replaces the old flat
 *      aurora div. Reacts to the cursor and auto-demos when idle.
 *   2. A PixelTrail cursor dust overlay, rose-tinted, gated on non-mobile.
 *   3. CircularText halo around the BrandMark (rotating eyebrow).
 *   4. TextPressure on "COCKPIT" with an aurora text-fill gradient.
 *   5. Meta row with mode badges + RangePill.
 */
import { useRef } from 'react'
import { motion } from 'motion/react'
import { Badge } from '@finance-os/ui/components'
import { AuroraCanvas } from '@/components/brand/aurora-canvas'
import { BrandMark } from '@/components/brand/brand-mark'
import { CircularText } from '@/components/reactbits/circular-text'
import { RotatingText } from '@/components/reactbits/rotating-text'
import { TextPressure } from '@/components/reactbits/text-pressure'
import { RangePill } from './range-pill'
import { StatusDot } from './status-dot'

type CockpitHeroProps<T extends string> = {
  rotations: string[]
  range: T
  rangeOptions: Array<{ label: string; value: T }>
  onRangeChange: (next: T) => void
  isDemo?: boolean
  isAdmin?: boolean
}

export function CockpitHero<T extends string>({
  rotations,
  range,
  rangeOptions,
  onRangeChange,
  isDemo,
  isAdmin,
}: CockpitHeroProps<T>) {
  const containerRef = useRef<HTMLElement>(null)

  return (
    <section
      ref={containerRef}
      className="relative isolate overflow-hidden rounded-[28px] border border-border/60 px-5 py-8 md:px-10 md:py-12"
      style={{ background: 'var(--surface-0)' }}
    >
      {/* Layer 1 — WebGL liquid aurora */}
      <AuroraCanvas
        opacity={0.85}
        mouseForce={22}
        colors={['#ff4f9f', '#c084fc', '#7aa2ff']}
      />

      {/* Subtle top/bottom fades so typography stays readable */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, oklch(from var(--surface-0) l c h / 18%) 0%, transparent 18%, transparent 70%, oklch(from var(--surface-0) l c h / 60%) 100%)',
        }}
      />

      {/* Layer 3 — Circular rotating label around a BrandMark, top-right */}
      <div className="pointer-events-none absolute right-6 top-6 hidden md:block">
        <div className="relative">
          <CircularText
            text="· FINANCE · OS · COCKPIT · PERSONNEL "
            spinDuration={22}
            onHover="speedUp"
            className="!w-[148px] !h-[148px] !text-primary/85 !text-[10px] !tracking-[0.28em] !font-mono !font-semibold"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandMark size="lg" />
          </div>
        </div>
      </div>

      {/* Layer 4 — Title block */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-3xl"
      >
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-primary/85">
          <span aria-hidden="true">◈</span>
          <span>Finance OS</span>
          <span aria-hidden="true" className="text-muted-foreground/40">·</span>
          <RotatingText
            texts={rotations}
            rotationInterval={4200}
            mainClassName="text-foreground/75"
          />
        </p>

        {/* Container has generous vertical + horizontal breathing so the
            pressure-expanded letters don't get clipped at hover. */}
        <div className="mt-2 h-[120px] px-1 py-3 sm:h-[160px] md:h-[200px] lg:h-[220px] md:px-2">
          <TextPressure
            text="COCKPIT"
            ariaLabel="Cockpit"
            minFontSize={56}
            width
            weight
            italic={false}
            flex
            scale
            gradient="linear-gradient(92deg, var(--aurora-a) 0%, var(--aurora-b) 50%, var(--aurora-c) 100%)"
            className="text-center"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isDemo && (
            <Badge variant="warning" className="gap-1.5">
              <StatusDot tone="warn" pulse size={6} />
              Mode démo
            </Badge>
          )}
          {isAdmin && (
            <Badge variant="violet" className="gap-1.5">
              <StatusDot tone="violet" size={6} />
              Mode admin
            </Badge>
          )}
          <Badge variant="glass" className="font-mono text-[10px] tracking-[0.16em]">
            période · {range}
          </Badge>
        </div>
      </motion.div>

      {/* Layer 5 — Range pill on the bottom right */}
      <div className="relative mt-6 flex items-center justify-between gap-4 md:mt-10">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          horizon d'analyse
        </span>
        <RangePill
          layoutId="cockpit-range"
          ariaLabel="Période"
          options={rangeOptions}
          value={range}
          onChange={onRangeChange}
        />
      </div>
    </section>
  )
}

export default CockpitHero
