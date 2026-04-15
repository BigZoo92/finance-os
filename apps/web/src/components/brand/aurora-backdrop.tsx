/**
 * AuroraBackdrop — a subtle, full-bleed aurora wash for hero sections.
 *
 * Used sparingly to warm a page without eating attention from data. Pairs a
 * dotted grid with the Aurora blob at medium intensity. Always positioned
 * `absolute inset-0 -z-10` by default.
 */
import { AuroraShape } from '@/components/reactbits/aurora-shape'

type AuroraBackdropProps = {
  className?: string
  /** Relative intensity of the blobs. 0.35 = restrained (default). */
  intensity?: number
  /** Emit the dotted grid overlay. */
  grid?: boolean
}

export function AuroraBackdrop({ className = '', intensity = 0.35, grid = true }: AuroraBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <AuroraShape
        size={620}
        intensity={intensity}
        blur={120}
        className="left-[-12%] top-[-18%]"
      />
      <AuroraShape
        size={480}
        intensity={intensity * 0.75}
        blur={140}
        animated={false}
        className="right-[-8%] top-[10%] hidden md:block"
      />
      {grid && (
        <div
          className="absolute inset-0 bg-grid-dots opacity-70"
          style={{
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
          }}
        />
      )}
    </div>
  )
}

export default AuroraBackdrop
