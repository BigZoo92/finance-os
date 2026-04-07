import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

type DataPoint = { date: string; value: number }

type SparklineProps = {
  data: DataPoint[]
  /** Height in px. Width is always 100% of container. */
  height?: number
  color?: string
  gradientFrom?: string
  gradientTo?: string
  showTooltip?: boolean
  showArea?: boolean
  showDots?: boolean
  animate?: boolean
  formatValue?: (v: number) => string
  className?: string
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [ref])

  return width
}

export function D3Sparkline({
  data,
  height = 120,
  color = 'var(--primary)',
  gradientFrom = 'var(--primary)',
  gradientTo = 'transparent',
  showTooltip = true,
  showArea = true,
  showDots = false,
  animate = true,
  formatValue,
  className,
}: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(containerRef)
  const uid = useId().replace(/:/g, '')
  const gradientId = `spark-grad-${uid}`
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const margin = { top: 4, right: 2, bottom: 4, left: 2 }
  const innerW = Math.max(width - margin.left - margin.right, 0)
  const innerH = height - margin.top - margin.bottom

  const { line, area, points } = useMemo(() => {
    if (!data.length || innerW <= 0) return { line: null, area: null, points: [] as Array<{ x: number; y: number; date: string; value: number }> }

    const xs = d3.scaleLinear().domain([0, data.length - 1]).range([0, innerW])
    const extent = d3.extent(data, d => d.value) as [number, number]
    const pad = (extent[1] - extent[0]) * 0.1 || 1
    const ys = d3.scaleLinear().domain([extent[0] - pad, extent[1] + pad]).range([innerH, 0])

    const ln = d3.line<DataPoint>().x((_, i) => xs(i)).y(d => ys(d.value)).curve(d3.curveCatmullRom.alpha(0.5))
    const ar = d3.area<DataPoint>().x((_, i) => xs(i)).y0(innerH).y1(d => ys(d.value)).curve(d3.curveCatmullRom.alpha(0.5))
    const pts = data.map((d, i) => ({ x: xs(i), y: ys(d.value), date: d.date, value: d.value }))

    return { line: ln, area: ar, points: pts }
  }, [data, innerW, innerH])

  const pathRef = useRef<SVGPathElement>(null)
  const animatedRef = useRef(false)

  useEffect(() => {
    if (!animate || !pathRef.current || animatedRef.current) return
    const path = pathRef.current
    const length = path.getTotalLength()
    if (!length) return
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    path.getBoundingClientRect()
    const anim = path.animate(
      [{ strokeDashoffset: `${length}` }, { strokeDashoffset: '0' }],
      { duration: 1200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
    )
    animatedRef.current = true
    return () => anim.cancel()
  }, [animate, line])

  const handleTouch = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!showTooltip || !points.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    if (!touch) return
    const touchX = touch.clientX - rect.left - margin.left
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]
      if (!pt) continue
      const dist = Math.abs(pt.x - touchX)
      if (dist < minDist) { minDist = dist; closest = i }
    }
    setHoveredIdx(closest)
  }, [points, showTooltip, margin.left])

  if (!data.length || !line || !area || width <= 0) {
    return (
      <div ref={containerRef} className={`w-full ${className ?? ''}`} style={{ height }}>
        <div className="flex h-full items-center justify-center">
          <span className="font-mono text-xs text-muted-foreground/50">[ no data ]</span>
        </div>
      </div>
    )
  }

  const linePath = line(data) ?? ''
  const areaPath = area(data) ?? ''
  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null
  const fmt = formatValue ?? ((v: number) => v.toLocaleString('fr-FR'))

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className="overflow-visible touch-none"
        onTouchMove={handleTouch}
        onTouchEnd={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity={0.3} />
            <stop offset="100%" stopColor={gradientTo} stopOpacity={0} />
          </linearGradient>
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {showArea && (
            <path
              d={areaPath}
              fill={`url(#${gradientId})`}
              className="transition-opacity duration-300"
              style={{ opacity: hoveredIdx !== null ? 0.6 : 0.4 }}
            />
          )}

          <path
            ref={pathRef}
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_1px_2px_oklch(from_var(--primary)_l_c_h/30%)]"
          />

          {showDots && points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={hoveredIdx === i ? 4 : 2}
              fill={color}
              className="transition-all duration-150"
              style={{ opacity: hoveredIdx === i ? 1 : 0.5 }}
            />
          ))}

          {hovered && (
            <>
              <line x1={hovered.x} y1={0} x2={hovered.x} y2={innerH} stroke={color} strokeWidth={1} strokeDasharray="2,2" opacity={0.4} />
              <circle cx={hovered.x} cy={hovered.y} r={5} fill="var(--background)" stroke={color} strokeWidth={2} />
            </>
          )}

          {showTooltip && points.map((pt, i) => (
            <rect
              key={`h-${i}`}
              x={pt.x - innerW / data.length / 2}
              y={0}
              width={innerW / data.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-crosshair"
            />
          ))}
        </g>
      </svg>

      {showTooltip && hovered && (
        <div
          className="pointer-events-none absolute -top-10 z-10 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs shadow-lg transition-all duration-100"
          style={{ left: Math.min(Math.max(hovered.x + margin.left - 40, 0), width - 100) }}
        >
          <span className="font-financial font-semibold">{fmt(hovered.value)}</span>
          <span className="ml-1.5 text-muted-foreground">{hovered.date}</span>
        </div>
      )}
    </div>
  )
}

export function MiniSparkline({
  data,
  width = 80,
  height = 24,
  color = 'var(--primary)',
  className,
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}) {
  const path = useMemo(() => {
    if (data.length < 2) return ''
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([1, width - 1])
    const ext = d3.extent(data) as [number, number]
    const pad = (ext[1] - ext[0]) * 0.15 || 1
    const y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).range([height - 2, 2])
    const ln = d3.line<number>().x((_, i) => x(i)).y(d => y(d)).curve(d3.curveCatmullRom.alpha(0.5))
    return ln(data) ?? ''
  }, [data, width, height])

  if (data.length < 2) return null

  const last = data[data.length - 1]
  const first = data[0]
  const trendColor = last !== undefined && first !== undefined && last >= first ? 'var(--positive)' : 'var(--negative)'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`inline-block ${className ?? ''}`} style={{ width, height }}>
      <path d={path} fill="none" stroke={color === 'auto' ? trendColor : color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
