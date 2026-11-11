import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

export default function CeoControlPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api('/reports/overview')
      setData(res.data)
    } catch (err) {
      toast.error(err.message || 'Failed to load control center')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = data
    ? [
        {
          label: 'Active admissions',
          value: String(data.patients.active_admissions),
          meta: `${data.beds.occupied}/${data.beds.total} beds occupied`,
        },
        {
          label: 'Occupancy',
          value: `${data.beds.occupancy_percent}%`,
          meta: `${data.beds.available} beds free`,
        },
        {
          label: 'Today collection',
          value: formatPkr(data.finance.today_collection),
          meta: 'Payments today',
        },
        {
          label: 'Outstanding fees',
          value: formatPkr(data.finance.outstanding_fees),
          meta: `${data.finance.open_invoices} open invoices`,
        },
      ]
    : []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2>CEO Control Center</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-ghost ui-btn-md" to="/app/reports">
            Full reports
          </Link>
        </div>
      </div>

      {loading || !data ? (
        <SkeletonCards count={4} />
      ) : (
        <>
          <div className="stat-grid">
            {stats.map((item) => (
              <article className="stat-card" key={item.label}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <span>{item.meta}</span>
              </article>
            ))}
          </div>

          <div className="dash-grid">
            <section className="panel">
              <div className="panel-head">
                <h3>Live alerts</h3>
              </div>
              <ul className="list">
                {data.alerts.map((a) => (
                  <li key={a.title}>
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>Operations pulse</h3>
              </div>
              <ul className="list">
                <li>
                  <strong>Pending tasks</strong>
                  <span>{data.operations.pending_tasks}</span>
                </li>
                <li>
                  <strong>Open complaints</strong>
                  <span>{data.operations.open_complaints}</span>
                </li>
                <li>
                  <strong>Active employees</strong>
                  <span>{data.operations.active_employees}</span>
                </li>
                <li>
                  <strong>Visitors today</strong>
                  <span>{data.operations.today_visitors}</span>
                </li>
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
