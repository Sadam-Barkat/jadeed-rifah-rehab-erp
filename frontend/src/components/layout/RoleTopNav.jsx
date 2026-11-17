import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { MODULES } from '../../data/modules'
import { ROLE_HOME_PATH } from '../../lib/roleHomes'
import NotificationBell from './NotificationBell'
import ProfileEditModal from './ProfileEditModal'
import ThemeSettingsModal from './ThemeSettingsModal'
import './layout.css'

const FINANCE_TABS = [
  { to: '/app/billing?tab=fees', label: 'Fees & payments', match: 'fees' },
  { to: '/app/billing?tab=petty', label: 'Petty expenses', match: 'petty' },
  { to: '/app/billing?tab=bills', label: 'Facility bills', match: 'bills' },
]

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function navItemsForUser(user) {
  const allowed = new Set(user?.modules || [])
  const items = MODULES.filter((m) => allowed.has(m.id)).map((m) => ({
    id: m.id,
    label: m.name,
    to: m.path,
  }))

  const home = ROLE_HOME_PATH[user?.role_slug]
  if (
    home &&
    home.includes('/home/') &&
    !items.some((i) => i.to === home)
  ) {
    items.unshift({ id: 'home', label: 'Home', to: home })
  }

  return items
}

export default function RoleTopNav({ onLogoutClick }) {
  const { user } = useAuth()
  const location = useLocation()
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const isFinance = user?.role_slug === 'finance'
  const items = useMemo(() => (isFinance ? [] : navItemsForUser(user)), [isFinance, user])

  useEffect(() => {
    if (!menuOpen) return undefined
    function onDoc(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const params = new URLSearchParams(location.search)
  const financeTab = params.get('tab') || 'fees'
  const onBilling = location.pathname.startsWith('/app/billing')

  return (
    <>
      <header className="role-nav">
        <div className="role-nav-brand">
          <img
            className="brand-logo role-nav-logo"
            src="/brand/jadeed-logo.png?v=6"
            alt="Jadeed Rifah"
          />
          <div className="role-nav-brand-text">
            <strong>Jadeed Rifah</strong>
            <span>{user?.role || 'Staff'}</span>
          </div>
        </div>

        <nav className="role-nav-tabs" aria-label="Staff sections">
          {isFinance
            ? FINANCE_TABS.map((tab) => {
                const active = onBilling && financeTab === tab.match
                return (
                  <NavLink
                    key={tab.match}
                    to={tab.to}
                    className={`role-nav-tab${active ? ' is-active' : ''}`}
                  >
                    {tab.label}
                  </NavLink>
                )
              })
            : items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={({ isActive }) => `role-nav-tab${isActive ? ' is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
        </nav>

        <div className="role-nav-right">
          <NotificationBell />
          <div className="role-nav-category" title={user?.role || ''}>
            <span className="role-nav-category-label">Staff</span>
            <strong>{user?.role || '—'}</strong>
          </div>

          <div className="role-profile" ref={menuRef}>
            <button
              type="button"
              className="role-profile-btn"
              aria-label="Profile menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="role-profile-img" />
              ) : (
                <span className="role-profile-initials">{initials(user?.name)}</span>
              )}
            </button>

            {menuOpen ? (
              <div className="role-profile-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setProfileOpen(true)
                  }}
                >
                  <UserRound size={16} />
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setThemeOpen(true)
                  }}
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogoutClick?.()
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <ThemeSettingsModal open={themeOpen} onClose={() => setThemeOpen(false)} />
      <ProfileEditModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
