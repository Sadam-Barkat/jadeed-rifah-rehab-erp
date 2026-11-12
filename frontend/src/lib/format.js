/** Compact PKR for KPIs/dashboards (K / M). */
export function formatPkr(amount) {
  const n = Number(amount || 0)
  if (!Number.isFinite(n)) return 'PKR 0'

  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const digits = m >= 10 ? 1 : 2
    return `${sign}PKR ${m.toFixed(digits)}M`
  }

  if (abs >= 1_000) {
    const k = abs / 1_000
    const digits = k >= 100 ? 0 : 1
    return `${sign}PKR ${Number(k.toFixed(digits))}K`
  }

  return `${sign}PKR ${Math.round(abs).toLocaleString('en-PK')}`
}

/** Full PKR when exact amount is needed (receipts / forms). */
export function formatPkrExact(amount) {
  const n = Number(amount || 0)
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
