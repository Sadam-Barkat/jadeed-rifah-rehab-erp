import { useEffect, useRef, useState } from 'react'

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

export default function BarChart({ title, series = [] }) {
  const max = Math.max(1, ...series.map((s) => Number(s.value) || 0))
  const scrollerRef = useRef(null)
  const [activeTip, setActiveTip] = useState(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined

    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [series.length])

  useEffect(() => {
    setActiveTip(null)
  }, [series])

  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h3>{title}</h3>
      </div>
      {series.length === 0 ? (
        <p className="panel-copy">No data</p>
      ) : (
        <div className="bar-chart" ref={scrollerRef} role="img" aria-label={title}>
          {series.map((item, idx) => {
            const value = Number(item.value) || 0
            const height = Math.max(4, Math.round((value / max) * 100))
            const tipKey = `${item.label}-${idx}`
            const open = activeTip === tipKey
            return (
              <div
                className={`bar-col${open ? ' is-tip' : ''}`}
                key={tipKey}
                tabIndex={0}
                onMouseEnter={() => setActiveTip(tipKey)}
                onMouseLeave={() => setActiveTip(null)}
                onFocus={() => setActiveTip(tipKey)}
                onBlur={() => setActiveTip(null)}
                onClick={() => setActiveTip((prev) => (prev === tipKey ? null : tipKey))}
              >
                <div className="bar-tip" role="tooltip">
                  <strong>{item.label}</strong>
                  <span>{formatFullValue(value)}</span>
                </div>
                <div className="bar-value">{formatBarValue(value)}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${height}%` }} />
                </div>
                <div className="bar-label">{item.label}</div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
