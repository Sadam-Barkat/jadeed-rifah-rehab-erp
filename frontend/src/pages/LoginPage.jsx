import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { MODULES } from '../data/modules'
import Button from '../components/ui/Button'
import './pages.css'

export default function LoginPage() {
  const { isAuthenticated, login, booting, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('owner@jadeed.local')
  const [password, setPassword] = useState('Owner@123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function homePath(modules = []) {
    const allowed = new Set(modules)
    return MODULES.find((m) => allowed.has(m.id))?.path || '/app'
  }

  if (booting) return null
  if (isAuthenticated) return <Navigate to={homePath(user?.modules)} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const loggedInUser = await login({ email, password })
      toast.success(`Welcome, ${loggedInUser.name}`)
      navigate(homePath(loggedInUser.modules), { replace: true })
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <img
            className="brand-logo large"
            src="/brand/jadeed-logo.png?v=6"
            alt="Jadeed Rifah Rehab & Care Center"
          />
          <div>
            <p className="eyebrow">Jadeed Rifah Rehab & Care Center</p>
            <h1>Smart Rehab Management ERP</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="ui-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="ui-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="ui-field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="ui-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button type="submit" size="lg" className="login-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
