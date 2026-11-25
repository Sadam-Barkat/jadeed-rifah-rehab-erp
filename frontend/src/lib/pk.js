/** Digits only. */
export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

/** Pakistan CNIC: 13 digits → #####-#######-# */
export function formatPkCnic(value) {
  const d = digitsOnly(value).slice(0, 13)
  if (d.length <= 5) return d
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
}

export function isValidPkCnic(value) {
  return /^\d{5}-\d{7}-\d{1}$/.test(formatPkCnic(value)) && digitsOnly(value).length === 13
}

/**
 * Pakistan mobile while typing.
 * Accepts 03XXXXXXXXX or +92XXXXXXXXXX only (rejects other starts).
 */
export function formatPkPhone(value) {
  const raw = String(value || '')
  if (raw.startsWith('+')) {
    let d = digitsOnly(raw).slice(0, 12) // 92 + 10
    if (d.length >= 1 && d[0] !== '9') return '+'
    if (d.length >= 2 && d.slice(0, 2) !== '92') return '+9'
    return `+${d}`
  }

  let d = digitsOnly(raw).slice(0, 11)
  if (d.length >= 1 && d[0] !== '0') return ''
  if (d.length >= 2 && d[1] !== '3') return '0'
  return d
}

/** Valid if 03XXXXXXXXX or +92 / 92 + 10-digit mobile. */
export function isValidPkPhone(value) {
  return Boolean(normalizePkPhone(value))
}

/** Always returns local 03XXXXXXXXX, or null if empty/invalid. */
export function normalizePkPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const d = digitsOnly(raw)
  if (/^03\d{9}$/.test(d)) return d
  if (/^92\d{10}$/.test(d)) return `0${d.slice(2)}`
  return null
}

export const PK_PHONE_HINT = 'Use 03XXXXXXXXX or +92XXXXXXXXXX'

export function ageFromDob(dateOfBirth) {
  if (!dateOfBirth) return ''
  const dob = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return ''
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1
  if (age < 0 || age > 150) return ''
  return String(age)
}
