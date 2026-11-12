import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

export default function PatientsPage({ embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false

    async function load(page = 1) {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: '20',
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

    load(1)
    return () => {
      cancelled = true
    }
  }, [debounced, status])

  async function goPage(page) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '20',
      })
      if (debounced) params.set('search', debounced)
      if (status) params.set('status', status)
      const data = await api(`/patients?${params.toString()}`)
      setRows(data.data || [])
      setMeta(data.meta || meta)
    } catch (err) {
      toast.error(err.message || 'Failed to load patients')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={embedded ? 'embedded-page' : 'page'}>
      {embedded ? (
        <div className="list-toolbar">
          <Link className="ui-btn ui-btn-primary ui-btn-md" to="/app/registration">
            Register patient
          </Link>
        </div>
      ) : (
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

      <section className="panel">
        <div className="filters-row">
          <input
            className="ui-input"
            placeholder="Search code, name, CNIC, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="ui-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="registered">Registered</option>
            <option value="admitted">Admitted</option>
            <option value="discharged">Discharged</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {loading ? (
          <SkeletonCards count={2} />
        ) : rows.length === 0 ? (
          <p className="panel-copy">No patients found.</p>
        ) : (
          <div className="scroll-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>CNIC</th>
                  <th>Status</th>
                  <th>Guardian</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.patient_code}</td>
                    <td>{row.full_name}</td>
                    <td>{row.phone || '—'}</td>
                    <td>{row.cnic || '—'}</td>
                    <td>
                      <span className="badge">{row.status}</span>
                    </td>
                    <td>{row.guardian_name || '—'}</td>
                    <td>
                      <Link className="ui-btn ui-btn-ghost ui-btn-sm" to={`/app/patients/${row.id}`}>
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pager-row">
          <span>
            Page {meta.current_page} of {meta.last_page} · {meta.total} total
          </span>
          <div className="page-actions">
            <Button
              size="sm"
              variant="ghost"
              disabled={meta.current_page <= 1 || loading}
              onClick={() => goPage(meta.current_page - 1)}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={meta.current_page >= meta.last_page || loading}
              onClick={() => goPage(meta.current_page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
