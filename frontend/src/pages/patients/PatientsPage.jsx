import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Pagination from '../../components/ui/Pagination'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'registered', label: 'Requests' },
  { id: 'admitted', label: 'Admitted' },
  { id: 'discharge_requested', label: 'Discharge requests' },
  { id: 'discharged', label: 'Discharged' },
]

const PER_PAGE = 12

export default function PatientsPage({ embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, status])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: String(PER_PAGE),
        })
        if (debounced) params.set('search', debounced)
        if (status) params.set('status', status)

        const data = await api(`/patients?${params.toString()}`)
        if (!cancelled) {
          setRows(data.data || [])
          setMeta(data.meta || { current_page: 1, last_page: 1, total: 0 })
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load patients')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [debounced, status, page])

  return (
    <div className={embedded ? 'embedded-page' : 'page'}>
      {embedded ? null : (
        <div className="page-header">
          <div>
            <p className="eyebrow">Patient Care</p>
            <h2>Patient Management</h2>
          </div>
          <div className="page-actions">
            <Link className="ui-btn ui-btn-primary ui-btn-md" to="/app/registration">
              Register patient
            </Link>
          </div>
        </div>
      )}

      <div className="mgmt-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Patient status">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              className={`filter-tab ${status === tab.id ? 'is-active' : ''}`}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mgmt-toolbar-actions">
          <input
            className="ui-input"
            type="search"
            placeholder="Search code, name, CNIC, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search patients"
          />
          {embedded ? (
            <Link
              className="ui-btn ui-btn-secondary ui-btn-md"
              to="/app/registration"
              state={{ backTo: '/app/management?tab=patients' }}
            >
              Register
            </Link>
          ) : null}
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={4} />
      ) : rows.length === 0 ? (
        <p className="panel-copy">No patients found.</p>
      ) : (
        <div className="entity-card-grid scroll-panel dash-scroll-panel">
          {rows.map((row) => (
            <article key={row.id} className="entity-card">
              <div className="entity-card-top">
                <div>
                  <p className="entity-card-code">{row.patient_code}</p>
                  <h3>{row.full_name}</h3>
                </div>
                <span className="badge">{String(row.status || '').replaceAll('_', ' ')}</span>
              </div>
              <dl className="entity-card-meta">
                <div>
                  <dt>Phone</dt>
                  <dd>{row.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Plan</dt>
                  <dd>{row.plan_days ? `${row.plan_days} days` : '—'}</dd>
                </div>
              </dl>
              <div className="entity-card-actions">
                <Link
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                  to={`/app/patients/${row.id}`}
                  state={embedded ? { backTo: '/app/management?tab=patients' } : undefined}
                >
                  View
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination
        page={meta.current_page}
        lastPage={meta.last_page}
        total={meta.total}
        perPage={PER_PAGE}
        itemLabel="patients"
        disabled={loading}
        onChange={setPage}
      />
    </div>
  )
}
