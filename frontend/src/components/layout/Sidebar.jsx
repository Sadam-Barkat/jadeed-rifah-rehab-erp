import { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  BedDouble,
  Briefcase,
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  ClipboardPlus,
  DoorOpen,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Package,
  Pill,
  Receipt,
  Settings,
  ScrollText,
  Stethoscope,
  UserPlus,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  CircleArrowRight,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_NAV, MODULES, MODULE_GROUPS } from '../../data/modules'
import './layout.css'

const NAV_ICONS = {
  'owner-dashboard': LayoutDashboard,
  'admin-patients': BedDouble,
  'admin-pharmacy': Pill,
  'admin-inventory': Package,
  'admin-finance': Wallet,
  'admin-visitors': DoorOpen,
  'admin-staff': UsersRound,
  users: Briefcase,
  settings: Settings,
  logs: ScrollText,
  registration: UserPlus,
  admission: ClipboardPlus,
  patients: Users,
  beds: BedDouble,
  'medical-records': FileText,
  doctors: Stethoscope,
  nursing: HeartPulse,
  treatment: Activity,
  discharge: CircleArrowRight,
  pharmacy: Pill,
  billing: Receipt,
  accounts: Calculator,
  reports: BarChart3,
  inventory: Package,
  kitchen: UtensilsCrossed,
  visitors: DoorOpen,
}

const ALERT_NAV = {
  'admin-pharmacy': 'pharmacy',
  'admin-inventory': 'inventory',
}

function NavIcon({ id }) {
  const Icon = NAV_ICONS[id] || LayoutDashboard
  return <Icon size={20} className="nav-link-icon" aria-hidden />
}

export default function Sidebar({ open, collapsed, onNavigate, onToggleCollapse }) {
  const { user } = useAuth()
  const allowed = new Set(user?.modules || [])
  const isAdmin = user?.role_slug === 'admin'
  const [stockAlerts, setStockAlerts] = useState({ pharmacy: false, inventory: false })

  useEffect(() => {
    if (!isAdmin) return undefined
    let alive = true

    async function loadAlerts() {
      try {
        const res = await api('/reports/stock-alerts')
        if (!alive) return
        setStockAlerts({
          pharmacy: !!res.data?.pharmacy?.alert,
          inventory: !!res.data?.inventory?.alert,
        })
      } catch {
        if (alive) setStockAlerts({ pharmacy: false, inventory: false })
      }
    }

    loadAlerts()
    const timer = setInterval(loadAlerts, 30000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [isAdmin])

  function alertFor(itemId) {
    const key = ALERT_NAV[itemId]
    return key ? !!stockAlerts[key] : false
  }

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img
          className="brand-logo"
          src="/brand/jadeed-logo.png?v=6"
          alt="Jadeed Rifah Rehab & Care Center"
        />
        <div className="sidebar-brand-text">
          <strong>Jadeed Rifah</strong>
          <span>{isAdmin ? 'Admin' : 'Rehab ERP'}</span>
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {isAdmin ? (
          <div className="nav-group">
            {ADMIN_NAV.filter((m) => allowed.has(m.id)).map((item) => {
              const hasAlert = alertFor(item.id)
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${hasAlert ? 'has-stock-alert' : ''}`}
                  onClick={onNavigate}
                  title={hasAlert ? `${item.name} — low stock` : item.name}
                >
                  <span className="nav-link-icon-wrap">
                    <NavIcon id={item.id} />
                    {hasAlert ? <span className="nav-alert-dot" aria-hidden /> : null}
                  </span>
                  <span className="nav-link-text">{item.name}</span>
                  {hasAlert ? <span className="nav-alert-badge" aria-label="Low stock alert">!</span> : null}
                </NavLink>
              )
            })}
          </div>
        ) : (
          MODULE_GROUPS.map((group) => {
            const items = MODULES.filter((m) => m.group === group && allowed.has(m.id))
            if (!items.length) return null
            return (
              <div className="nav-group" key={group}>
                <p className="nav-group-title">{group}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={onNavigate}
                    title={item.name}
                  >
                    <NavIcon id={item.id} />
                    <span className="nav-link-text">{item.name}</span>
                  </NavLink>
                ))}
              </div>
            )
          })
        )}
      </nav>
    </aside>
  )
}
