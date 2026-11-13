import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../lib/api'
import DashboardView from '../components/dashboard/DashboardView'
import { defaultRange } from '../components/dashboard/DateRangeFilter'
import './pages.css'

export default function OwnerDashboard() {
  const [filter, setFilter] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = useCallback(async (nextFilter = filter) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({
        section: 'overview',
        from: nextFilter.from,
        to: nextFilter.to,
      })
      const res = await api(`/reports/dashboard?${q}`)
      setData(res.data)
    } catch (err) {
      toast.error(err.message || 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [])

  return (
    <DashboardView
      eyebrow="Admin Dashboard"
      title={data?.title || 'Facility overview'}
      filter={filter}
      onFilterApply={(next) => {
        setFilter(next)
        load(next)
      }}
      loading={loading}
      data={data}
      compact
      enablePrint
      headerActions={
        <Link className="ui-btn ui-btn-primary ui-btn-md" to="/app/management">
          Management
        </Link>
      }
    />
  )
}
