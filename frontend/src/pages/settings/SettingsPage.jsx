import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import '../pages.css'

const THEME_KEY = 'jadeed_erp_theme'

function readTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_KEY, theme)
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [savingAccount, setSavingAccount] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [account, setAccount] = useState({
    email: user?.email || '',
    current_password: '',
    password: '',
    password_confirmation: '',
  })

  useEffect(() => {
    applyTheme(theme)
  }, [])

  useEffect(() => {
    if (user?.email) {
      setAccount((prev) => ({ ...prev, email: prev.email || user.email }))
    }
  }, [user?.email])

  async function handleAccountSubmit(e) {
    e.preventDefault()
    setSavingAccount(true)
    try {
      const body = {
        email: account.email,
        current_password: account.current_password,
      }
      if (account.password) {
        body.password = account.password
        body.password_confirmation = account.password_confirmation
      }
      const data = await api('/me/account', { method: 'PUT', body })
      toast.success('Account updated')
      await refreshUser?.(data.user)
      setAccount({
        email: data.user?.email || account.email,
        current_password: '',
        password: '',
        password_confirmation: '',
      })
    } catch (err) {
      toast.error(err.message || 'Failed to update account')
    } finally {
      setSavingAccount(false)
    }
  }

  function onThemeChange(next) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">System</p>
          <h2>Settings</h2>
        </div>
      </div>

      <form className="panel form-grid" onSubmit={handleAccountSubmit}>
        <div className="panel-head full">
          <h3>Account</h3>
        </div>
        <div className="ui-field">
          <label htmlFor="account_email">Email</label>
          <input
            id="account_email"
            type="email"
            className="ui-input"
            required
            value={account.email}
            onChange={(e) => setAccount((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="current_password">Current password</label>
          <div className="password-field">
            <input
              id="current_password"
              type={showCurrent ? 'text' : 'password'}
              className="ui-input"
              required
              value={account.current_password}
              onChange={(e) => setAccount((p) => ({ ...p, current_password: e.target.value }))}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="ui-field">
          <label htmlFor="password">New password</label>
          <div className="password-field">
            <input
              id="password"
              type={showNew ? 'text' : 'password'}
              className="ui-input"
              value={account.password}
              onChange={(e) => setAccount((p) => ({ ...p, password: e.target.value }))}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? 'Hide password' : 'Show password'}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="ui-field">
          <label htmlFor="password_confirmation">Confirm password</label>
          <div className="password-field">
            <input
              id="password_confirmation"
              type={showConfirm ? 'text' : 'password'}
              className="ui-input"
              value={account.password_confirmation}
              onChange={(e) => setAccount((p) => ({ ...p, password_confirmation: e.target.value }))}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="form-actions full">
          <Button type="submit" disabled={savingAccount}>
            {savingAccount ? 'Saving…' : 'Update account'}
          </Button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-head">
          <h3>Appearance</h3>
        </div>
        <div className="theme-toggle-row">
          <button
            type="button"
            className={`theme-option ${theme === 'light' ? 'is-active' : ''}`}
            onClick={() => onThemeChange('light')}
          >
            <span className="theme-option-title">Light</span>
            <span className="theme-option-meta">Bright interface</span>
          </button>
          <button
            type="button"
            className={`theme-option ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={() => onThemeChange('dark')}
          >
            <span className="theme-option-title">Dark</span>
            <span className="theme-option-meta">Low-light interface</span>
          </button>
        </div>
      </section>
    </div>
  )
}
