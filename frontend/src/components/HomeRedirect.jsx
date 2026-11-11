import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MODULES } from '../data/modules'

export default function HomeRedirect() {
  const { user } = useAuth()
  const allowed = new Set(user?.modules || [])
  const first = MODULES.find((m) => allowed.has(m.id))
  return <Navigate to={first?.path || '/login'} replace />
}
