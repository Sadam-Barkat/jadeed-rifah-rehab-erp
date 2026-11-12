import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import DashboardView from '../../components/dashboard/DashboardView'
import { defaultRange } from '../../components/dashboard/DateRangeFilter'
import { useAuth } from '../../context/AuthContext'
import '../pages.css'

const META = {
  receptionist: { eyebrow: 'Receptionist', title: 'Reception dashboard' },
  gatekeeper: { eyebrow: 'Gatekeeper', title: 'Gate dashboard' },
  doctor: { eyebrow: 'Doctor', title: 'Doctor dashboard' },
  nurse: { eyebrow: 'Nurse', title: 'Nurse dashboard' },
  finance: { eyebrow: 'Finance', title: 'Finance dashboard' },
  pharmacist: { eyebrow: 'Pharmacist', title: 'Pharmacy dashboard' },
  'inventory-manager': { eyebrow: 'Inventory Manager', title: 'Inventory dashboard' },
}

export default function RoleHomePage({ roleKey }) {
  const { user } = useAuth()
  const scope = roleKey || user?.role_slug
  const meta = META[scope] || { eyebrow: user?.role || 'Staff', title: 'Workspace' }
  const [filter, setFilter] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(
    async (nextFilter = filter) => {
      if (!scope) return
      setLoading(true)
      try {
        const q = new URLSearchParams({
          scope,
          from: nextFilter.from,
          to: nextFilter.to,
        })
        const res = await api(`/reports/dashboard?${q}`)
        setData(res.data)
      } catch (err) {
        toast.error(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    },
    [filter, scope]
  )

  useEffect(() => {
    load()
  }, [scope])

  return (
    <DashboardView
      eyebrow={meta.eyebrow}
      title={data?.title || meta.title}
      filter={filter}
      onFilterApply={(next) => {
        setFilter(next)
        load(next)
      }}
      loading={loading}
      data={data}
    />
  )
}
