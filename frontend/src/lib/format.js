export function formatPkr(amount) {
  const n = Number(amount || 0)
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
