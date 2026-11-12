function formatBarValue(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export default function BarChart({ title, series = [] }) {
  const max = Math.max(1, ...series.map((s) => Number(s.value) || 0))

  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h3>{title}</h3>
      </div>
      {series.length === 0 ? (
        <p className="panel-copy">No data</p>
      ) : (
        <div className="bar-chart" role="img" aria-label={title}>
          {series.map((item) => {
            const value = Number(item.value) || 0
            const height = Math.max(4, Math.round((value / max) * 100))
            return (
              <div className="bar-col" key={`${item.label}-${value}`}>
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
