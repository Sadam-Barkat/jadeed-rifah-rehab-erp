import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { downloadCsvFromApi } from '../../lib/csv'
import Button from '../../components/ui/Button'
import Pagination from '../../components/ui/Pagination'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const PER_PAGE = 20

const MONTHS = [
  { value: '', label: 'All months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export default function LogsPage() {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [date, setDate] = useState('')
  const [years, setYears] = useState([])
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, year, month, date])

  function buildParams(includePage = false) {
    const params = new URLSearchParams()
    if (includePage) {
      params.set('page', String(page))
      params.set('per_page', String(PER_PAGE))
    }
    if (debounced) params.set('search', debounced)
    if (date) {
      params.set('date', date)
    } else {
      if (year) params.set('year', year)
      if (month) params.set('month', month)
    }
    return params
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await api(`/audit-logs?${buildParams(true).toString()}`)
        if (!cancelled) {
          setRows(data.data || [])
          setMeta(data.meta || { current_page: 1, last_page: 1, total: 0 })
          const nextYears = Array.isArray(data.meta?.years) ? data.meta.years.map(String) : []
          setYears(nextYears)
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load logs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [page, debounced, year, month, date])

  async function handleExport() {
    setExporting(true)
    try {
      const params = buildParams(false)
      const stamp = date || [year || 'all', month || 'all'].join('-')
      await downloadCsvFromApi(
        `/audit-logs/export?${params.toString()}`,
        `audit-logs-${stamp}.csv`
      )
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Audit logs</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" disabled={exporting} onClick={handleExport}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      <div className="list-toolbar logs-toolbar">
        <input
          className="ui-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search logs"
        />
        <select
          className="ui-select"
          value={year}
          onChange={(e) => {
            setYear(e.target.value)
            setDate('')
          }}
          aria-label="Year"
          disabled={!!date}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          className="ui-select"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setDate('')
          }}
          aria-label="Month"
          disabled={!!date}
        >
          {MONTHS.map((m) => (
            <option key={m.value || 'all'} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          className="ui-input"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            if (e.target.value) {
              setYear('')
              setMonth('')
            }
          }}
          aria-label="Date"
        />
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>Activity</h3>
            <span className="panel-meta">{meta.total || 0} total</span>
          </div>
          {rows.length === 0 ? (
            <p className="panel-copy">No logs found.</p>
          ) : (
            <div className="scroll-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Summary</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.created_at || '—'}</td>
                      <td>{row.user || '—'}</td>
                      <td>{row.action || '—'}</td>
                      <td>{row.module || '—'}</td>
                      <td>{row.summary || '—'}</td>
                      <td>{row.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={meta.current_page || page}
            lastPage={meta.last_page || 1}
            disabled={loading}
            onChange={setPage}
          />
        </section>
      )}
    </div>
  )
}
