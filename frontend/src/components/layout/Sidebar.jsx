import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MODULES, MODULE_GROUPS } from '../../data/modules'
import './layout.css'

export default function Sidebar({ open, onNavigate }) {
  const { user } = useAuth()
  const allowed = new Set(user?.modules || [])

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="sidebar-brand">
        <img
          className="brand-logo"
          src="/brand/jadeed-logo.png?v=6"
          alt="Jadeed Rifah Rehab & Care Center"
        />
        <div>
          <strong>Jadeed Rifah</strong>
          <span>Rehab ERP</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {MODULE_GROUPS.map((group) => {
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
                >
                  {item.name}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
