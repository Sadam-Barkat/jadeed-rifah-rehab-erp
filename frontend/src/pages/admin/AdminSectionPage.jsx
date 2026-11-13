import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import DashboardView from '../../components/dashboard/DashboardView'
import { defaultRange } from '../../components/dashboard/DateRangeFilter'
import '../pages.css'

const STAFF_SECTIONS = new Set(['pharmacy', 'inventory'])
const PRINT_SECTIONS = new Set(['pharmacy', 'inventory'])

export default function AdminSectionPage({ section, fallbackTitle }) {
  const [filter, setFilter] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [staffOptions, setStaffOptions] = useState([])
  const showStaff = STAFF_SECTIONS.has(section)

  useEffect(() => {
    let alive = true
    async function loadStaff() {
      if (!showStaff) {
        setStaffOptions([])
        return
      }
      try {
        const res = await api('/reports/filter-meta')
        if (!alive) return
        const key = section === 'pharmacy' ? 'pharmacy_staff' : 'inventory_staff'
        setStaffOptions(Array.isArray(res.data?.[key]) ? res.data[key] : [])
      } catch {
        if (alive) setStaffOptions([])
      }
    }
    loadStaff()
    return () => {
      alive = false
    }
  }, [section, showStaff])

  const load = useCallback(
    async (nextFilter = filter) => {
      setLoading(true)
      try {
        const q = new URLSearchParams({
          section,
          from: nextFilter.from,
          to: nextFilter.to,
        })
        if (showStaff && nextFilter.created_by) {
          q.set('created_by', String(nextFilter.created_by))
        }
        const res = await api(`/reports/dashboard?${q}`)
        setData(res.data)
      } catch (err) {
        toast.error(err.message || 'Failed to load overview')
      } finally {
        setLoading(false)
      }
    },
    [filter, section, showStaff]
  )

  useEffect(() => {
    setFilter((prev) => ({ ...prev, created_by: '' }))
    const next = { ...filter, created_by: '' }
    load(next)
  }, [section])

  return (
    <DashboardView
      eyebrow="Admin Dashboard"
      title={data?.title || fallbackTitle}
      filter={filter}
      onFilterApply={(next) => {
        setFilter(next)
        load(next)
      }}
      loading={loading}
      data={data}
      compact
      enablePrint={PRINT_SECTIONS.has(section)}
      showStaffFilter={showStaff}
      staffOptions={staffOptions}
    />
  )
}
