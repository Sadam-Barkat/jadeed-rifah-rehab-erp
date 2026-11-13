import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Button from '../ui/Button'
import NotificationBell from './NotificationBell'
import './layout.css'

export default function Topbar({ onMenuToggle, onLogoutClick }) {
  const { user } = useAuth()
  const isAdmin = user?.role_slug === 'admin'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="ui-icon-btn menu-toggle"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="topbar-kicker">Jadeed Rifah Rehab & Care Center</p>
          <h1>{isAdmin ? 'Admin Dashboard' : 'Operations Console'}</h1>
        </div>
      </div>

      <div className="topbar-right">
        <NotificationBell />
        <div className="user-chip">
          <strong>{user?.name}</strong>
          <span>{user?.role}</span>
        </div>
        <Button variant="danger" size="sm" onClick={onLogoutClick}>
          <LogOut size={16} />
          Logout
        </Button>
      </div>
    </header>
  )
}
