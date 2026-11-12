import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import DashboardView from '../../components/dashboard/DashboardView'
import { defaultRange } from '../../components/dashboard/DateRangeFilter'
import { useAuth } from '../../context/AuthContext'
import '../pages.css'

export default function ReportsPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(
    async (nextFilter = filter) => {
      setLoading(true)
      try {
        const q = new URLSearchParams({
          from: nextFilter.from,
          to: nextFilter.to,
        })
        if (user?.role_slug === 'admin') q.set('section', 'overview')
        else if (user?.role_slug) q.set('scope', user.role_slug)
        const res = await api(`/reports/dashboard?${q}`)
        setData(res.data)
      } catch (err) {
        toast.error(err.message || 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    },
    [filter, user?.role_slug]
  )

  useEffect(() => {
    load()
  }, [user?.role_slug])

  return (
    <DashboardView
      eyebrow="Reports"
      title={data?.title || 'Reports'}
      filter={filter}
      onFilterApply={(next) => {
        setFilter(next)
        load(next)
      }}
      loading={loading}
      data={data}
      compact
    />
  )
}
