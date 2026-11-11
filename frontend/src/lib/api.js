const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const TOKEN_KEY = 'jadeed_erp_token'
const ACTIVITY_KEY = 'jadeed_erp_last_active'
const TIMEOUT_KEY = 'jadeed_erp_timeout_min'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
  touchActivity()
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ACTIVITY_KEY)
}

export function setSessionTimeoutMinutes(minutes) {
  const value = Number(minutes)
  localStorage.setItem(TIMEOUT_KEY, String(Number.isFinite(value) && value > 0 ? value : 60))
}

export function getSessionTimeoutMinutes() {
  const value = Number(localStorage.getItem(TIMEOUT_KEY))
  return Number.isFinite(value) && value > 0 ? value : 60
}

export function touchActivity() {
  localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
}

export function isSessionExpired() {
  if (!getToken()) return false
  const last = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
  if (!last) return false
  const limitMs = getSessionTimeoutMinutes() * 60 * 1000
  return Date.now() - last > limitMs
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  if (auth && isSessionExpired()) {
    clearToken()
    localStorage.removeItem('jadeed_erp_user')
    const error = new Error('Session expired. Please sign in again.')
    error.status = 401
    error.code = 'SESSION_EXPIRED'
    throw error
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = {
    Accept: 'application/json',
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.errors?.email?.[0] ||
      data?.errors?.password?.[0] ||
      'Request failed'
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  if (auth) touchActivity()

  return data
}
