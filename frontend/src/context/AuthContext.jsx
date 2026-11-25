import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  isSessionExpired,
  setSessionTimeoutMinutes,
  setStoredUser,
  setToken,
  touchActivity,
} from '../lib/api'
import { applyTheme, applyUserTheme } from '../lib/theme'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [booting, setBooting] = useState(Boolean(getToken()))

  useEffect(() => {
    if (user?.id) applyUserTheme(user)
    else applyTheme('light', null)
  }, [user?.id])

  async function signOutLocalAndServer() {
    try {
      if (getToken()) await api('/logout', { method: 'POST' })
    } catch {
      // ignore network logout errors
    }
    clearToken()
    setUser(null)
    applyTheme('light', null)
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!getToken()) {
        setBooting(false)
        return
      }

      if (isSessionExpired()) {
        await signOutLocalAndServer()
        if (!cancelled) setBooting(false)
        return
      }

      try {
        const data = await api('/me')
        if (!cancelled) {
          if (data.session_timeout_minutes) {
            setSessionTimeoutMinutes(data.session_timeout_minutes)
          }
          setStoredUser(data.user)
          setUser(data.user)
          applyUserTheme(data.user)
          touchActivity()
        }
      } catch {
        if (!cancelled) {
          clearToken()
          setUser(null)
          applyTheme('light', null)
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
        signOutLocalAndServer()
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
        setStoredUser(data.user)
        setUser(data.user)
        applyUserTheme(data.user)
        touchActivity()
        return data.user
      },
      async refreshUser(nextUser) {
        if (nextUser) {
          setStoredUser(nextUser)
          setUser(nextUser)
          applyUserTheme(nextUser)
          return nextUser
        }
        const data = await api('/me')
        if (data.session_timeout_minutes) {
          setSessionTimeoutMinutes(data.session_timeout_minutes)
        }
        setStoredUser(data.user)
        setUser(data.user)
        applyUserTheme(data.user)
        return data.user
      },
      async logout() {
        await signOutLocalAndServer()
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
