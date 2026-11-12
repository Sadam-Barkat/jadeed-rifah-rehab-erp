import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathForUser } from '../lib/roleHomes'

export default function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePathForUser(user)} replace />
}
