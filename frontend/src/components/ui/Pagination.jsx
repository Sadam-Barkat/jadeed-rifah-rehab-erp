function buildPages(current, last) {
  const cur = Math.max(1, current || 1)
  const end = Math.max(1, last || 1)
  if (end <= 7) {
    return Array.from({ length: end }, (_, i) => i + 1)
  }

  const pages = new Set([1, end, cur, cur - 1, cur + 1, cur - 2, cur + 2])
  const sorted = [...pages].filter((p) => p >= 1 && p <= end).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}

export default function Pagination({
  page = 1,
  lastPage = 1,
  disabled = false,
  onChange,
}) {
  const current = Math.max(1, page)
  const last = Math.max(1, lastPage)
  const pages = buildPages(current, last)

  return (
    <nav className="g-pager" aria-label="Pagination">
      <div className="g-pager-pages">
        <button
          type="button"
          className="g-pager-btn"
          disabled={disabled || current <= 1}
          onClick={() => onChange?.(current - 1)}
        >
          <span aria-hidden>←</span> Prev
        </button>
        {pages.map((item, idx) =>
          item === '…' ? (
            <span key={`e-${idx}`} className="g-pager-ellipsis" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`g-pager-num ${item === current ? 'is-active' : ''}`}
              disabled={disabled}
              aria-current={item === current ? 'page' : undefined}
              onClick={() => onChange?.(item)}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          className="g-pager-btn"
          disabled={disabled || current >= last}
          onClick={() => onChange?.(current + 1)}
        >
          Next <span aria-hidden>→</span>
        </button>
      </div>
    </nav>
  )
}
