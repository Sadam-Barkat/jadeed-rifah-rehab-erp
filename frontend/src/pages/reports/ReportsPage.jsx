import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api('/reports/overview')
      setData(res.data)
    } catch (err) {
      toast.error(err.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Compliance</p>
          <h2>Reports & AI Manager</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h3>Patient & beds</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Registered patients</td>
                    <td>{data.patients.total_registered}</td>
                  </tr>
                  <tr>
                    <td>Admitted patients</td>
                    <td>{data.patients.admitted}</td>
                  </tr>
                  <tr>
                    <td>Active admissions</td>
                    <td>{data.patients.active_admissions}</td>
                  </tr>
                  <tr>
                    <td>Bed occupancy</td>
                    <td>
                      {data.beds.occupancy_percent}% ({data.beds.occupied}/{data.beds.total})
                    </td>
                  </tr>
                  <tr>
                    <td>Available beds</td>
                    <td>{data.beds.available}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Finance</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Today collection</td>
                    <td>{formatPkr(data.finance.today_collection)}</td>
                  </tr>
                  <tr>
                    <td>Outstanding fees</td>
                    <td>{formatPkr(data.finance.outstanding_fees)}</td>
                  </tr>
                  <tr>
                    <td>Open invoices</td>
                    <td>{data.finance.open_invoices}</td>
                  </tr>
                  <tr>
                    <td>Ledger income</td>
                    <td>{formatPkr(data.finance.ledger_income)}</td>
                  </tr>
                  <tr>
                    <td>Ledger expense</td>
                    <td>{formatPkr(data.finance.ledger_expense)}</td>
                  </tr>
                  <tr>
                    <td>Ledger balance</td>
                    <td>{formatPkr(data.finance.ledger_balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Operations</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Pending tasks</td>
                    <td>{data.operations.pending_tasks}</td>
                  </tr>
                  <tr>
                    <td>Open complaints</td>
                    <td>{data.operations.open_complaints}</td>
                  </tr>
                  <tr>
                    <td>Active employees</td>
                    <td>{data.operations.active_employees}</td>
                  </tr>
                  <tr>
                    <td>Visitors today</td>
                    <td>{data.operations.today_visitors}</td>
                  </tr>
                  <tr>
                    <td>Low medicines</td>
                    <td>{data.operations.low_medicines}</td>
                  </tr>
                  <tr>
                    <td>Low inventory</td>
                    <td>{data.operations.low_inventory}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="panel-copy">Generated: {data.generated_at}</p>
          </section>
        </>
      )}
    </div>
  )
}
