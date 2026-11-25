import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function formatBarValue(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function formatFullValue(value) {
  const n = Number(value) || 0
  return Number.isInteger(n)
    ? n.toLocaleString('en-PK')
    : n.toLocaleString('en-PK', { maximumFractionDigits: 2 })
}

function niceMax(raw) {
  const n = Math.max(1, Number(raw) || 1)
  if (n <= 5) return 5
  if (n <= 10) return 10
  const pow = 10 ** Math.floor(Math.log10(n))
  const step = pow
  return Math.ceil(n / step) * step
}

/** Smooth cubic path through points (Catmull-Rom → Bezier). */
function smoothLinePath(points) {
  if (!points.length) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function BarChart({
  title,
  series = [],
  type = 'bar',
  categories = [],
  lines = [],
}) {
  const scrollerRef = useRef(null)
  const panelRef = useRef(null)
  const [activeTip, setActiveTip] = useState(null)
  const [floatTip, setFloatTip] = useState(null)
  const [picked, setPicked] = useState([])
  const isCompare = type === 'compare'
  const isLine = type === 'line'
  const barMax = Math.max(1, ...series.map((s) => Math.abs(Number(s.value) || 0)))

  const hideFloatTip = () => {
    setActiveTip(null)
    setFloatTip(null)
  }

  const showFloatTip = (event, key, titleText, valueText) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const box = panelRef.current?.getBoundingClientRect()
    const tipHalf = 70
    const tipH = 52
    const pad = 10

    let x = rect.left + rect.width / 2
    let y = rect.top - 8
    let place = 'above'

    if (box) {
      const minX = box.left + tipHalf + pad
      const maxX = box.right - tipHalf - pad
      x = Math.min(Math.max(x, minX), maxX)

      if (y - tipH < box.top + pad) {
        place = 'below'
        y = rect.bottom + 8
        if (y + tipH > box.bottom - pad) {
          y = Math.max(box.top + pad, box.bottom - tipH - pad)
        }
      } else if (y > box.bottom - pad) {
        y = box.bottom - pad
      }
    } else {
      x = Math.min(Math.max(x, tipHalf + pad), window.innerWidth - tipHalf - pad)
      y = Math.max(tipH + pad, y)
    }

    setActiveTip(key)
    setFloatTip({
      title: titleText,
      value: valueText,
      x,
      y,
      place,
    })
  }

  const scrollable = !isLine && !isCompare && series.length > 5

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !scrollable) return undefined

    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
      hideFloatTip()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scrollable, series.length])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !scrollable) return

    const now = new Date()
    const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(now)
    const year = String(now.getFullYear())
    const day = String(now.getDate())
    let focusIndex = -1

    series.forEach((item, index) => {
      const label = String(item.label || '').trim()
      // Daily labels like "24 Nov"
      if (new RegExp(`^${day}\\s+${month}$`, 'i').test(label)) {
        focusIndex = index
        return
      }
      // Monthly labels like "Nov 2026"
      if (
        focusIndex < 0
        && new RegExp(`(^|\\s)${month}(\\s|$)`, 'i').test(label)
        && (!/\b\d{4}\b/.test(label) || label.includes(year))
      ) {
        focusIndex = index
      }
    })

    if (focusIndex < 0) focusIndex = series.length - 1
    const focusBar = el.children[focusIndex]
    if (!(focusBar instanceof HTMLElement)) return

    // Keep current day/month in view; user can still scroll left for older bars.
    el.scrollLeft = Math.max(
      0,
      focusBar.offsetLeft + focusBar.offsetWidth - el.clientWidth
    )
  }, [series, scrollable])

  useEffect(() => {
    hideFloatTip()
    setPicked([])
  }, [series, lines, categories])

  useEffect(() => {
    if (!floatTip) return undefined
    const onScroll = () => hideFloatTip()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [floatTip])

  const togglePick = (tipKey, point) => {
    setPicked((prev) => {
      if (prev.some((p) => p.key === tipKey)) {
        return prev.filter((p) => p.key !== tipKey)
      }
      const next = [...prev, { key: tipKey, ...point }]
      return next.length > 2 ? [next[1], next[2]] : next
    })
  }

  const compare = useMemo(() => {
    if (!isCompare || !categories.length || !lines.length) return null

    const W = 520
    const H = 168
    const pad = { top: 14, right: 10, bottom: 28, left: 32 }
    const innerW = W - pad.left - pad.right
    const innerH = H - pad.top - pad.bottom
    const n = categories.length

    const allValues = lines.flatMap((line) =>
      (line.values || []).filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v))).map(Number)
    )
    const yMax = niceMax(Math.max(1, ...allValues, 0))

    const xAt = (idx) => pad.left + (n <= 1 ? innerW / 2 : (idx / (n - 1)) * innerW)
    const yAt = (value) => pad.top + innerH - (Number(value) / yMax) * innerH

    const builtLines = lines.map((line) => {
      const points = (line.values || [])
        .map((value, idx) => {
          if (value === null || value === undefined) return null
          return {
            x: xAt(idx),
            y: yAt(value),
            value: Number(value),
            label: categories[idx],
            seriesLabel: line.label,
            color: line.color || '#2f5f9b',
            idx,
          }
        })
        .filter(Boolean)

      return {
        key: line.key || line.label,
        label: line.label,
        color: line.color || '#2f5f9b',
        points,
        path: smoothLinePath(points),
      }
    })

    const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: pad.top + innerH * t,
      value: yMax * (1 - t),
    }))

    return { W, H, pad, yMax, builtLines, grid, categories, xAt }
  }, [isCompare, categories, lines])

  const trend = useMemo(() => {
    if (!isLine || series.length === 0) return null

    const W = 560
    const H = 220
    const pad = { top: 18, right: 16, bottom: 36, left: 36 }
    const innerW = W - pad.left - pad.right
    const innerH = H - pad.top - pad.bottom
    const max = Math.max(1, ...series.map((s) => Number(s.value) || 0))
    const yMax = niceMax(max)
    const n = series.length
    const points = series.map((item, idx) => {
      const value = Number(item.value) || 0
      const x = pad.left + (n <= 1 ? innerW / 2 : (idx / (n - 1)) * innerW)
      const y = pad.top + innerH - (value / yMax) * innerH
      return { x, y, value, label: item.label }
    })

    const linePath = smoothLinePath(points)
    const areaPath =
      points.length > 1
        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`
        : ''

    const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: pad.top + innerH * t,
      value: yMax * (1 - t),
    }))

    return { W, H, pad, points, linePath, areaPath, grid, labelStep: n <= 8 ? 1 : Math.ceil(n / 8) }
  }, [isLine, series])

  const tipPortal =
    floatTip &&
    createPortal(
      <div
        className={`chart-float-tip${floatTip.place === 'below' ? ' is-below' : ''}`}
        style={{ left: `${floatTip.x}px`, top: `${floatTip.y}px` }}
        role="tooltip"
      >
        <strong>{floatTip.title}</strong>
        <span>{floatTip.value}</span>
      </div>,
      document.body
    )

  return (
    <section className="panel chart-panel" ref={panelRef}>
      <div className="panel-head">
        <h3>{title}</h3>
      </div>

      {isCompare && compare ? (
        <div className="trend-chart trend-chart-compare" role="img" aria-label={title}>
          <svg viewBox={`0 0 ${compare.W} ${compare.H}`} className="trend-chart-svg">
            {compare.grid.map((g, idx) => (
              <g key={`cg-${idx}`}>
                <line
                  x1={compare.pad.left}
                  x2={compare.W - compare.pad.right}
                  y1={g.y}
                  y2={g.y}
                  className="trend-grid"
                />
                <text x={compare.pad.left - 8} y={g.y + 4} textAnchor="end" className="trend-axis-label">
                  {formatBarValue(g.value)}
                </text>
              </g>
            ))}

            {compare.categories.map((label, idx) => (
              <text
                key={`cx-${label}`}
                x={compare.xAt(idx)}
                y={compare.H - 14}
                textAnchor="middle"
                className="trend-x-label"
              >
                {label}
              </text>
            ))}

            {compare.builtLines.map((line) => (
              <path
                key={`path-${line.key}`}
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="trend-line-multi"
              />
            ))}

            {picked.length === 2 ? (
              <g className="trend-link">
                <line
                  x1={picked[0].x}
                  y1={picked[0].y}
                  x2={picked[1].x}
                  y2={picked[1].y}
                  className="trend-link-line"
                />
                <text
                  x={(picked[0].x + picked[1].x) / 2}
                  y={(picked[0].y + picked[1].y) / 2 - 8}
                  textAnchor="middle"
                  className="trend-link-label"
                >
                  {formatFullValue(picked[0].value)} → {formatFullValue(picked[1].value)}
                </text>
              </g>
            ) : null}

            {compare.builtLines.flatMap((line) =>
              line.points.map((p) => {
                const tipKey = `${line.key}-${p.idx}`
                const active = activeTip === tipKey
                const isPicked = picked.some((item) => item.key === tipKey)
                return (
                  <g
                    key={tipKey}
                    className={`trend-point${active ? ' is-active' : ''}${isPicked ? ' is-picked' : ''}`}
                    onMouseEnter={(e) =>
                      showFloatTip(e, tipKey, p.seriesLabel, `${p.label}: ${formatFullValue(p.value)}`)
                    }
                    onMouseLeave={hideFloatTip}
                    onFocus={(e) =>
                      showFloatTip(e, tipKey, p.seriesLabel, `${p.label}: ${formatFullValue(p.value)}`)
                    }
                    onBlur={hideFloatTip}
                    onClick={() =>
                      togglePick(tipKey, {
                        x: p.x,
                        y: p.y,
                        value: p.value,
                        label: p.label,
                        seriesLabel: p.seriesLabel,
                      })
                    }
                    tabIndex={0}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={active || isPicked ? 6 : 4}
                      fill={line.color}
                      fillOpacity={0.2}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={active || isPicked ? 3.5 : 2.75}
                      fill={line.color}
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  </g>
                )
              })
            )}
          </svg>
          <div className="trend-legend">
            {compare.builtLines.map((line) => (
              <span key={`leg-${line.key}`} className="trend-legend-item">
                <i style={{ background: line.color }} />
                {line.label}
              </span>
            ))}
          </div>
        </div>
      ) : series.length === 0 && !isCompare ? (
        <p className="panel-copy">No data</p>
      ) : isLine && trend ? (
        <div className="trend-chart" role="img" aria-label={title}>
          <svg viewBox={`0 0 ${trend.W} ${trend.H}`} className="trend-chart-svg">
            {trend.grid.map((g, idx) => (
              <g key={`grid-${idx}`}>
                <line
                  x1={trend.pad.left}
                  x2={trend.W - trend.pad.right}
                  y1={g.y}
                  y2={g.y}
                  className="trend-grid"
                />
                <text x={trend.pad.left - 8} y={g.y + 4} textAnchor="end" className="trend-axis-label">
                  {formatBarValue(g.value)}
                </text>
              </g>
            ))}
            {trend.areaPath ? <path d={trend.areaPath} className="trend-area" /> : null}
            <path d={trend.linePath} className="trend-line" fill="none" />
            {trend.points.map((p, idx) => {
              const tipKey = `${p.label}-${idx}`
              const active = activeTip === tipKey
              return (
                <g
                  key={tipKey}
                  className={`trend-point${active ? ' is-active' : ''}`}
                  onMouseEnter={(e) =>
                    showFloatTip(e, tipKey, p.label, formatFullValue(p.value))
                  }
                  onMouseLeave={hideFloatTip}
                  onFocus={(e) => showFloatTip(e, tipKey, p.label, formatFullValue(p.value))}
                  onBlur={hideFloatTip}
                  tabIndex={0}
                >
                  <circle cx={p.x} cy={p.y} r={active ? 7 : 5} className="trend-dot-outer" />
                  <circle cx={p.x} cy={p.y} r={active ? 4 : 3} className="trend-dot" />
                  {idx % trend.labelStep === 0 || idx === trend.points.length - 1 ? (
                    <text x={p.x} y={trend.H - 12} textAnchor="middle" className="trend-x-label">
                      {p.label}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
        </div>
      ) : (
        <div
          className={`bar-chart${scrollable ? ' is-scroll' : ' is-fill'}`}
          ref={scrollerRef}
          role="img"
          aria-label={title}
        >
          {series.map((item, idx) => {
            const value = Number(item.value) || 0
            const abs = Math.abs(value)
            const heightPct = abs <= 0 ? 0 : Math.max(12, Math.round((abs / barMax) * 100))
            const tipKey = `${item.label}-${idx}`
            const open = activeTip === tipKey
            const fillClass =
              value < 0 ? ' is-neg' : value === 0 ? ' is-zero' : ''
            return (
              <div
                className={`bar-col${open ? ' is-tip' : ''}`}
                key={tipKey}
                tabIndex={0}
                onMouseEnter={(e) => showFloatTip(e, tipKey, item.label, formatFullValue(value))}
                onMouseLeave={hideFloatTip}
                onFocus={(e) => showFloatTip(e, tipKey, item.label, formatFullValue(value))}
                onBlur={hideFloatTip}
                onClick={(e) => {
                  if (activeTip === tipKey) hideFloatTip()
                  else showFloatTip(e, tipKey, item.label, formatFullValue(value))
                }}
              >
                <div className={`bar-value${value < 0 ? ' is-neg' : ''}`}>{formatBarValue(value)}</div>
                <div className="bar-track">
                  <div
                    className={`bar-fill${fillClass}`}
                    style={{ height: abs <= 0 ? undefined : `${heightPct}%` }}
                  />
                </div>
                <div className="bar-label">{item.label}</div>
              </div>
            )
          })}
        </div>
      )}
      {tipPortal}
    </section>
  )
}
