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

/** Days past expiry (null if no date or not yet expired). */
export function medicineExpiryInfo(expiryDate) {
  if (!expiryDate) return null
  const raw = String(expiryDate).slice(0, 10)
  const end = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor((today.getTime() - end.getTime()) / 86400000)
  if (days < 0) return null
  if (days === 0) {
    return { days: 0, label: 'Medicine expired today' }
  }
  return {
    days,
    label: `Medicine expired · ${days} day${days === 1 ? '' : 's'} ago`,
  }
}
