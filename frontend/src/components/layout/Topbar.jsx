import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Menu, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import Button from '../ui/Button'
import './layout.css'

export default function Topbar({ onMenuToggle, onLogoutClick }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let alive = true
    async function loadUnread() {
      try {
        const res = await api('/notifications/unread-count')
        if (alive) setUnread(res.data?.count || 0)
      } catch {
        if (alive) setUnread(0)
      }
    }
    loadUnread()
    const t = setInterval(loadUnread, 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [user?.id])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="ui-icon-btn menu-toggle" onClick={onMenuToggle} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div>
          <p className="topbar-kicker">Jadeed Rifah Rehab & Care Center</p>
          <h1>Operations Console</h1>
        </div>
      </div>

      <div className="topbar-right">
        <Link to="/app/notifications" className="notif-bell" aria-label="Notifications">
          <Bell size={18} />
          {unread > 0 ? <span className="notif-count">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
        <div className="user-chip">
          <strong>{user?.name}</strong>
          <span>{user?.role}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogoutClick}>
          <LogOut size={16} />
          Logout
        </Button>
      </div>
    </header>
  )
}
