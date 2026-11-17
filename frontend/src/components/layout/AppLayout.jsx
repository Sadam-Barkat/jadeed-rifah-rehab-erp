import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'
import RoleTopNav from './RoleTopNav'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import './layout.css'

const COLLAPSE_KEY = 'jadeed_sidebar_collapsed'

export default function AppLayout() {
  const { isAuthenticated, logout, booting, user } = useAuth()
  const isAdmin = user?.role_slug === 'admin'
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

  if (!isAdmin) {
    return (
      <div className="app-shell role-shell">
        <RoleTopNav onLogoutClick={() => setLogoutOpen(true)} />
        <main className="app-content role-content">
          <Outlet />
        </main>

        <Modal
          open={logoutOpen}
          title="Sign out"
          size="sm"
          confirm
          cancelLabel="Cancel"
          confirmLabel="Sign out"
          danger
          onClose={() => setLogoutOpen(false)}
          onConfirm={async () => {
            await logout()
            setLogoutOpen(false)
            toast.success('Signed out')
          }}
        >
          You will be signed out of this device.
        </Modal>
      </div>
    )
  }

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
        size="sm"
        confirm
        cancelLabel="Cancel"
        confirmLabel="Sign out"
        danger
        onClose={() => setLogoutOpen(false)}
        onConfirm={async () => {
          await logout()
          setLogoutOpen(false)
          toast.success('Signed out')
        }}
      >
        You will be signed out of this device.
      </Modal>
    </div>
  )
}
