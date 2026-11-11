import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import './layout.css'

export default function AppLayout() {
  const { isAuthenticated, logout, booting } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  if (booting) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar
          onMenuToggle={() => setSidebarOpen((v) => !v)}
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
