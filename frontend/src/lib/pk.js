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

/** Pakistan mobile: 11 digits, typically 03XXXXXXXXX */
export function formatPkPhone(value) {
  return digitsOnly(value).slice(0, 11)
}

export function isValidPkPhone(value) {
  const d = digitsOnly(value)
  return d.length === 11 && /^03\d{9}$/.test(d)
}

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
