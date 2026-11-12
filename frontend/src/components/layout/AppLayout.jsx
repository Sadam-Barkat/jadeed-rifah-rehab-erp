import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import './layout.css'

const COLLAPSE_KEY = 'jadeed_sidebar_collapsed'

export default function AppLayout() {
  const { isAuthenticated, logout, booting } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [logoutOpen, setLogoutOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  if (booting) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'show' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        onNavigate={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      <div className="app-main">
        <Topbar
          onMenuToggle={() => setMobileOpen((v) => !v)}
          onLogoutClick={() => setLogoutOpen(true)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <Modal
        open={logoutOpen}
        title="Sign out"
        confirmLabel="Logout"
        danger
        onClose={() => setLogoutOpen(false)}
        onConfirm={async () => {
          await logout()
          setLogoutOpen(false)
          toast.success('Signed out')
        }}
      >
        Do you want to end this session?
      </Modal>
    </div>
  )
}
