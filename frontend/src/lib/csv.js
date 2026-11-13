import { clearToken, getToken, isSessionExpired, touchActivity } from './api'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

function escapeCell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** Build and download a CSV from in-memory rows. */
export function downloadCsv(filename, columns, rows) {
  const header = columns.map(escapeCell).join(',')
  const body = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Download CSV from an authenticated API path (e.g. /audit-logs/export). */
export async function downloadCsvFromApi(path, filename = 'export.csv') {
  if (isSessionExpired()) {
    clearToken()
    localStorage.removeItem('jadeed_erp_user')
    const error = new Error('Session expired. Please sign in again.')
    error.status = 401
    throw error
  }

  const headers = { Accept: 'text/csv' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) {
    let message = 'Export failed'
    try {
      const data = await response.json()
      message = data?.message || message
    } catch {
      /* ignore */
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  touchActivity()
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
