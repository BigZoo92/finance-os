/**
 * SignalField — the signature Radar visualization.
 *
 * SVG rendered by React from a pure D3 layout: one trajectory per monitored
 * market over the observed window (x = real dates, y = variation since the
 * first observation). The latest point of each market sits on the right
 * edge; importance drives its emphasis (glow, rings, Command Pixel corner
 * marks), focus drives what recedes, and the dated context band above links
 * macro observations and events to the markets they reference.
 *
 * Accessibility: the field is `role="img"` with a title and description.
 * The equivalent structured content (signals, markets, events) lives in the
 * lists next to it; endpoints are pointer shortcuts, not the only path.
 */
import { css, cva } from '@finance-os/styled-system/css'
import { token } from '@finance-os/styled-system/tokens'
import { type ReactNode, useId, useRef } from 'react'
import {
  buildFieldLayout,
  type FieldMarkerInput,
  type FieldSeries,
  fieldHeightFor,
  radiusForImportance,
  resolveFieldTier,
} from '@/features/radar/field-layout'
import type { RadarTone } from '@/features/radar/view-model'
import { useElementWidth } from '@/lib/use-element-width'

const TONE_COLOR: Record<RadarTone, string> = {
  positive: token('colors.positive'),
  negative: token('colors.negative'),
  neutral: token('colors.foreground'),
}

const TONES: RadarTone[] = ['positive', 'negative', 'neutral']

const fieldFrame = css({ position: 'relative', w: 'full', minH: '250px', lg: { minH: '440px' } })

// Former tw-animate-css `animate-in fade-in-0 duration-500`, skipped under reduced motion.
const fieldCanvas = cva({
  base: { position: 'absolute', inset: '0', overflow: 'visible' },
  variants: {
    animated: {
      true: { animation: 'fadeIn 500ms ease' },
      false: {},
    },
  },
})

const gridRule = cva({
  variants: {
    kind: {
      time: { stroke: 'foreground/6' },
      zero: { stroke: 'foreground/14' },
      amplitude: { stroke: 'foreground/5' },
    },
  },
})

const axisLabel = css({ fill: 'foreground/30', fontFamily: 'mono', fontSize: '9px' })

const fadeGroup = css({
  transitionProperty: 'opacity',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _motionReduce: { transitionProperty: 'none' },
})

const focusHalo = cva({
  variants: {
    ring: {
      inner: { stroke: 'primary/30' },
      outer: { stroke: 'primary/15' },
    },
  },
})

const cornerMarks = css({ fill: 'primary' })

const leaderLine = css({ stroke: 'foreground/25' })

const seriesLabel = cva({
  base: { fontFamily: 'sans' },
  variants: {
    strong: {
      true: { fill: 'foreground', fontWeight: 'semibold' },
      false: { fill: 'foreground/70' },
    },
  },
})

const seriesSublabel = css({ fill: 'foreground/50', fontFamily: 'sans' })

const markerLabel = cva({
  base: { fontFamily: 'sans' },
  variants: {
    focused: {
      true: { fill: 'foreground' },
      false: { fill: 'foreground/55' },
    },
  },
})

const hitArea = css({ cursor: 'pointer' })

type SignalFieldProps = {
  series: FieldSeries[]
  markers: FieldMarkerInput[]
  /** Markets emphasized by the current focus. */
  focusIds: ReadonlySet<string>
  focusMarkerIds: ReadonlySet<string>
  /** Trajectories recede (macro focus or an unrelated selection). */
  dimSeries: boolean
  /** Observation attached to a strong market endpoint (direct labeling). */
  sublabelById: ReadonlyMap<string, string>
  reducedMotion: boolean
  title: string
  description: string
  onSelectSeries: (id: string, trigger: Element) => void
  onSelectMarker: (id: string, trigger: Element) => void
  /** Overlays positioned by the parent (caption, quiet state, detail). */
  children?: ReactNode
}

export function SignalField({
  series,
  markers,
  focusIds,
  focusMarkerIds,
  dimSeries,
  sublabelById,
  reducedMotion,
  title,
  description,
  onSelectSeries,
  onSelectMarker,
  children,
}: SignalFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(containerRef)
  const uid = useId().replace(/:/g, '')
  const titleId = `${uid}-title`
  const descriptionId = `${uid}-desc`

  const tier = resolveFieldTier(width || 1024)
  const height = fieldHeightFor(tier, width || 1024)
  const layout =
    width > 0 ? buildFieldLayout({ series, markers, width, height, tier, focusIds }) : null
  const hasFocus = focusIds.size > 0 || focusMarkerIds.size > 0
  const fontSize = tier === 'mobile' ? 11 : 12

  /**
   * Pointer shortcuts are delegated from the SVG root: endpoints and markers
   * carry data attributes, the lists next to the field remain the keyboard
   * and screen-reader path.
   */
  const handlePointer = (event: React.MouseEvent<SVGSVGElement>) => {
    const hit = (event.target as Element).closest('[data-series-hit],[data-marker-hit]')
    if (!hit) return
    const seriesId = hit.getAttribute('data-series-hit')
    if (seriesId) {
      onSelectSeries(seriesId, hit)
      return
    }
    const markerId = hit.getAttribute('data-marker-hit')
    if (markerId) onSelectMarker(markerId, hit)
  }

  return (
    <div ref={containerRef} className={fieldFrame} {...(width > 0 ? { style: { height } } : {})}>
      {layout ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: pointer shortcut only, the Signaux and Marchés lists next to the field are the keyboard path
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onClick={handlePointer}
          className={fieldCanvas({ animated: !reducedMotion })}
        >
          <title id={titleId}>{title}</title>
          <desc id={descriptionId}>{description}</desc>
          <defs>
            {TONES.map(tone => (
              <radialGradient key={tone} id={`${uid}-glow-${tone}`}>
                <stop offset="0%" stopColor={TONE_COLOR[tone]} stopOpacity={0.42} />
                <stop offset="100%" stopColor={TONE_COLOR[tone]} stopOpacity={0} />
              </radialGradient>
            ))}
          </defs>

          {/* Restrained grid: time ticks, zero baseline, two amplitude rules */}
          <g>
            {layout.xTicks.map(tick => (
              <line
                key={`x-${tick.t}`}
                x1={tick.x}
                x2={tick.x}
                y1={layout.plot.top}
                y2={layout.plot.bottom}
                className={gridRule({ kind: 'time' })}
              />
            ))}
            {layout.yTicks.map(tick => (
              <line
                key={`y-${tick.value}`}
                x1={layout.plot.left}
                x2={layout.plot.right}
                y1={tick.y}
                y2={tick.y}
                className={gridRule({ kind: tick.value === 0 ? 'zero' : 'amplitude' })}
              />
            ))}
            {layout.yTicks.map(tick => (
              <text
                key={`yl-${tick.value}`}
                x={layout.plot.left}
                y={tick.value > 0 ? tick.y + 11 : tick.y - 5}
                className={axisLabel}
              >
                {tick.label}
              </text>
            ))}
            {layout.xTicks
              .filter(tick => tick.label !== null)
              .map((tick, index, all) => (
                <text
                  key={`xl-${tick.t}`}
                  x={tick.x}
                  y={layout.height - 8}
                  textAnchor={index === 0 ? 'start' : index === all.length - 1 ? 'end' : 'middle'}
                  className={axisLabel}
                >
                  {tick.label}
                </text>
              ))}
          </g>

          {/* Trajectories, least important first so emphasis paints on top */}
          {[...layout.series]
            .sort((left, right) => left.importance - right.importance)
            .map(item => {
              const focused = focusIds.has(item.id)
              const recessive = dimSeries || (hasFocus && !focused)
              const strong = focused || item.importance >= 3
              const color = TONE_COLOR[item.tone]
              const r = radiusForImportance(item.importance, tier)
              const sublabel = strong ? sublabelById.get(item.id) : undefined
              const cornerOffset = r + 22
              return (
                <g
                  key={item.id}
                  data-series-id={item.id}
                  data-focused={focused || undefined}
                  className={fadeGroup}
                  opacity={recessive ? 0.22 : 1}
                >
                  <path
                    d={item.d}
                    fill="none"
                    stroke={color}
                    strokeWidth={strong ? 1.6 : item.importance >= 2 ? 1.3 : 1}
                    strokeOpacity={item.tone === 'neutral' ? 0.26 : strong ? 0.5 : 0.36}
                    strokeLinecap="round"
                  />
                  {strong ? (
                    <circle
                      cx={item.end.x}
                      cy={item.end.y}
                      r={focused ? r * 8 : r * 6}
                      fill={`url(#${uid}-glow-${item.tone})`}
                    />
                  ) : null}
                  {item.importance >= 2 || focused ? (
                    <circle
                      cx={item.end.x}
                      cy={item.end.y}
                      r={r + 9}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.45}
                      {...(item.importance === 2 && !focused ? { strokeDasharray: '2 3' } : {})}
                    />
                  ) : null}
                  {strong ? (
                    <>
                      <circle
                        cx={item.end.x}
                        cy={item.end.y}
                        r={r + 20}
                        fill="none"
                        className={focusHalo({ ring: 'inner' })}
                      />
                      <circle
                        cx={item.end.x}
                        cy={item.end.y}
                        r={r + 31}
                        fill="none"
                        className={focusHalo({ ring: 'outer' })}
                      />
                      <g className={cornerMarks}>
                        <rect
                          x={item.end.x - cornerOffset - 2}
                          y={item.end.y - cornerOffset - 2}
                          width={4}
                          height={4}
                        />
                        <rect
                          x={item.end.x + cornerOffset - 2}
                          y={item.end.y - cornerOffset - 2}
                          width={4}
                          height={4}
                        />
                        <rect
                          x={item.end.x - cornerOffset - 2}
                          y={item.end.y + cornerOffset - 2}
                          width={4}
                          height={4}
                        />
                        <rect
                          x={item.end.x + cornerOffset - 2}
                          y={item.end.y + cornerOffset - 2}
                          width={4}
                          height={4}
                        />
                      </g>
                    </>
                  ) : null}
                  <circle
                    cx={item.end.x}
                    cy={item.end.y}
                    r={r}
                    fill={color}
                    fillOpacity={item.tone === 'neutral' ? 0.75 : 1}
                  />
                  {item.labelY !== null && Math.abs(item.labelY - item.end.y) > 6 ? (
                    <line
                      x1={item.end.x + r + 2}
                      y1={item.end.y}
                      x2={item.end.x + 8}
                      y2={item.labelY}
                      className={leaderLine}
                    />
                  ) : null}
                  {item.labelY !== null ? (
                    <text
                      x={item.end.x + 10}
                      y={item.labelY + 4}
                      className={seriesLabel({ strong })}
                      style={{ fontSize }}
                    >
                      {item.label}
                    </text>
                  ) : null}
                  {sublabel && item.labelY !== null ? (
                    <text
                      x={item.end.x + 10}
                      y={item.labelY + 4 + fontSize + 2}
                      className={seriesSublabel}
                      style={{ fontSize: fontSize - 1 }}
                    >
                      {sublabel}
                    </text>
                  ) : null}
                  <circle
                    cx={item.end.x}
                    cy={item.end.y}
                    r={22}
                    fill="transparent"
                    className={hitArea}
                    data-series-hit={item.id}
                  />
                </g>
              )
            })}

          {/* Dated context band: macro observations and events within the window */}
          {layout.markers.map(marker => {
            const focused = focusMarkerIds.has(marker.id)
            const recessive = hasFocus && !focused && focusMarkerIds.size > 0
            const color =
              marker.kind === 'macro'
                ? token('colors.teal')
                : marker.attention
                  ? token('colors.primary')
                  : token('colors.foreground')
            return (
              <g
                key={marker.id}
                data-marker-id={marker.id}
                className={fadeGroup}
                opacity={recessive ? 0.35 : 1}
              >
                {marker.links.map(link => (
                  <line
                    key={link.targetId}
                    x1={marker.x}
                    y1={marker.y}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={color}
                    strokeOpacity={0.28}
                    strokeDasharray="3 4"
                  />
                ))}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={focused ? 4.5 : 3.5}
                  fill={color}
                  fillOpacity={marker.kind === 'macro' ? 0.85 : 0.6}
                />
                <text
                  x={marker.x + 9}
                  y={marker.y + 4}
                  className={markerLabel({ focused })}
                  style={{ fontSize: 11 }}
                >
                  {marker.label}
                </text>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={18}
                  fill="transparent"
                  className={hitArea}
                  data-marker-hit={marker.id}
                />
              </g>
            )
          })}
        </svg>
      ) : null}
      {children}
    </div>
  )
}
