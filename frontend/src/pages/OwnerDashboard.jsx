import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { formatPkr } from '../lib/format'
import { SkeletonCards } from '../components/ui/Skeleton'
import './pages.css'

export default function OwnerDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await api('/reports/overview')
        if (alive) setData(res.data)
      } catch (err) {
        if (alive) toast.error(err.message || 'Failed to load overview')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const stats = data
    ? [
        {
          label: 'Active patients',
          value: String(data.patients.admitted),
          meta: `of ${data.beds.total} beds`,
        },
        {
          label: 'Bed occupancy',
          value: `${data.beds.occupancy_percent}%`,
          meta: `${data.beds.available} beds free`,
        },
        {
          label: 'Today collection',
          value: formatPkr(data.finance.today_collection),
          meta: 'PKR',
        },
        {
          label: 'Pending items',
          value: String(data.operations.pending_tasks + data.operations.open_complaints),
          meta: 'tasks + complaints',
        },
      ]
    : []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Owner / Chairman</p>
          <h2>Institution overview</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-ghost ui-btn-md" to="/app/reports">
            Reports
          </Link>
          <Link className="ui-btn ui-btn-primary ui-btn-md" to="/app/ceo-control">
            Control center
          </Link>
        </div>
      </div>

      {loading || !data ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="stat-grid">
          {stats.map((item) => (
            <article className="stat-card" key={item.label}>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <span>{item.meta}</span>
            </article>
          ))}
        </div>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Priority alerts</h3>
          </div>
          {data ? (
            <ul className="list">
              {data.alerts.map((a) => (
                <li key={a.title}>
                  <strong>{a.title}</strong>
                  <span>{a.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-copy">Loading...</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Quick modules</h3>
          </div>
          <div className="quick-links">
            <Link to="/app/patients">Patients</Link>
            <Link to="/app/billing">Billing</Link>
            <Link to="/app/pharmacy">Pharmacy</Link>
            <Link to="/app/hr">HR</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
