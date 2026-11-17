const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const TOKEN_KEY = 'jadeed_erp_token'
const USER_KEY = 'jadeed_erp_user'
const ACTIVITY_KEY = 'jadeed_erp_last_active'
const TIMEOUT_KEY = 'jadeed_erp_timeout_min'

/** Per-tab auth so one role login does not take over other open tabs. */
const authStore = window.sessionStorage

function migrateSharedAuthOnce() {
  try {
    const sharedToken = localStorage.getItem(TOKEN_KEY)
    if (sharedToken && !authStore.getItem(TOKEN_KEY)) {
      authStore.setItem(TOKEN_KEY, sharedToken)
      const user = localStorage.getItem(USER_KEY)
      if (user) authStore.setItem(USER_KEY, user)
      const activity = localStorage.getItem(ACTIVITY_KEY)
      if (activity) authStore.setItem(ACTIVITY_KEY, activity)
    }
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ACTIVITY_KEY)
  } catch {
    // ignore
  }
}

migrateSharedAuthOnce()

export function getToken() {
  return authStore.getItem(TOKEN_KEY)
}

export function setToken(token) {
  authStore.setItem(TOKEN_KEY, token)
  touchActivity()
}

export function clearToken() {
  authStore.removeItem(TOKEN_KEY)
  authStore.removeItem(ACTIVITY_KEY)
  authStore.removeItem(USER_KEY)
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ACTIVITY_KEY)
  } catch {
    // ignore
  }
}

export function getStoredUser() {
  try {
    const raw = authStore.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user) {
  if (!user) {
    authStore.removeItem(USER_KEY)
    return
  }
  authStore.setItem(USER_KEY, JSON.stringify(user))
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
  authStore.setItem(ACTIVITY_KEY, String(Date.now()))
}

export function isSessionExpired() {
  if (!getToken()) return false
  const last = Number(authStore.getItem(ACTIVITY_KEY) || 0)
  if (!last) return false
  const limitMs = getSessionTimeoutMinutes() * 60 * 1000
  return Date.now() - last > limitMs
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  if (auth && isSessionExpired()) {
    clearToken()
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
    const firstFieldError = data?.errors
      ? Object.values(data.errors).flat().find(Boolean)
      : null
    const message =
      firstFieldError ||
      data?.message ||
      'Request failed'
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  if (auth) touchActivity()

  return data
}
