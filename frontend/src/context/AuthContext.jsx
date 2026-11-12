import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  api,
  clearToken,
  getToken,
  isSessionExpired,
  setSessionTimeoutMinutes,
  setToken,
  touchActivity,
} from '../lib/api'

const AuthContext = createContext(null)
const USER_KEY = 'jadeed_erp_user'

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readUser())
  const [booting, setBooting] = useState(Boolean(getToken()))

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!getToken()) {
        setBooting(false)
        return
      }

      if (isSessionExpired()) {
        clearToken()
        localStorage.removeItem(USER_KEY)
        setUser(null)
        setBooting(false)
        return
      }

      try {
        const data = await api('/me')
        if (!cancelled) {
          if (data.session_timeout_minutes) {
            setSessionTimeoutMinutes(data.session_timeout_minutes)
          }
          localStorage.setItem(USER_KEY, JSON.stringify(data.user))
          setUser(data.user)
          touchActivity()
        }
      } catch {
        if (!cancelled) {
          clearToken()
          localStorage.removeItem(USER_KEY)
          setUser(null)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return undefined

    const onActivity = () => {
      if (getToken()) touchActivity()
    }

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))

    const timer = window.setInterval(() => {
      if (isSessionExpired()) {
        clearToken()
        localStorage.removeItem(USER_KEY)
        setUser(null)
      }
    }, 30000)

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity))
      window.clearInterval(timer)
    }
  }, [user])

  const value = useMemo(
    () => ({
      user,
      booting,
      isAuthenticated: Boolean(user),
      async login({ email, password }) {
        const data = await api('/login', {
          method: 'POST',
          body: { email, password },
          auth: false,
        })
        setToken(data.token)
        if (data.session_timeout_minutes) {
          setSessionTimeoutMinutes(data.session_timeout_minutes)
        }
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        setUser(data.user)
        touchActivity()
        return data.user
      },
      async refreshUser(nextUser) {
        if (nextUser) {
          localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
          setUser(nextUser)
          return nextUser
        }
        const data = await api('/me')
        if (data.session_timeout_minutes) {
          setSessionTimeoutMinutes(data.session_timeout_minutes)
        }
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        setUser(data.user)
        return data.user
      },
      async logout() {
        try {
          if (getToken()) await api('/logout', { method: 'POST' })
        } catch {
          // ignore network logout errors
        }
        clearToken()
        localStorage.removeItem(USER_KEY)
        setUser(null)
      },
    }),
    [user, booting],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
