import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

function currentPeriod() {
  const d = new Date()
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1),
  }
}

export default function PayrollPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [payingId, setPayingId] = useState(null)
  const [finalizingId, setFinalizingId] = useState(null)
  const [runs, setRuns] = useState([])
  const [items, setItems] = useState([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [form, setForm] = useState(currentPeriod())

  async function load(runId = selectedRunId) {
    setLoading(true)
    try {
      const runsRes = await api('/payroll-runs')
      const nextRuns = runsRes.data || []
      setRuns(nextRuns)

      const activeRunId = runId || (nextRuns[0] ? String(nextRuns[0].id) : '')
      setSelectedRunId(activeRunId)

      if (activeRunId) {
        const itemsRes = await api(`/payroll-items?payroll_run_id=${activeRunId}&per_page=50`)
        setItems(itemsRes.data || [])
      } else {
        setItems([])
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleGenerate(e) {
    e.preventDefault()
    setGenerating(true)
    try {
      const data = await api('/payroll-runs', {
        method: 'POST',
        body: {
          year: Number(form.year),
          month: Number(form.month),
        },
      })
      toast.success(`Payroll ${data.data.run_code} generated`)
      await load(String(data.data.id))
    } catch (err) {
      toast.error(err.message || 'Failed to generate payroll')
    } finally {
      setGenerating(false)
    }
  }

  async function finalizeRun(run) {
    setFinalizingId(run.id)
    try {
      const data = await api(`/payroll-runs/${run.id}/finalize`, { method: 'POST', body: {} })
      toast.success(`${data.data.run_code} finalized`)
      load(selectedRunId)
    } catch (err) {
      toast.error(err.message || 'Finalize failed')
    } finally {
      setFinalizingId(null)
    }
  }

  async function markPaid(item) {
    setPayingId(item.id)
    try {
      const data = await api(`/payroll-items/${item.id}/pay`, {
        method: 'POST',
        body: { payment_method: 'bank' },
      })
      toast.success(`${data.data.slip_code} paid`)
      load(selectedRunId)
    } catch (err) {
      toast.error(err.message || 'Payment mark failed')
    } finally {
      setPayingId(null)
    }
  }

  const selectedRun = runs.find((r) => String(r.id) === String(selectedRunId))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">HR</p>
          <h2>Payroll & Salary</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleGenerate}>
            <div className="panel-head full">
              <h3>Generate monthly payroll</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="year">Year</label>
              <input
                id="year"
                className="ui-input"
                type="number"
                min="2020"
                required
                value={form.year}
                onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="month">Month</label>
              <select
                id="month"
                className="ui-select"
                required
                value={form.month}
                onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={generating}>
                {generating ? 'Generating...' : 'Generate payroll'}
              </Button>
            </div>
          </form>

          <section className="panel form-grid">
            <div className="ui-field">
              <label htmlFor="run">Payroll run</label>
              <select
                id="run"
                className="ui-select"
                value={selectedRunId}
                onChange={(e) => {
                  setSelectedRunId(e.target.value)
                  load(e.target.value)
                }}
              >
                <option value="">Select run</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.run_code} · {r.period} · {r.status}
                  </option>
                ))}
              </select>
            </div>
            {selectedRun && selectedRun.status === 'draft' && (
              <div className="form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={finalizingId === selectedRun.id}
                  onClick={() => finalizeRun(selectedRun)}
                >
                  Finalize run
                </Button>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Salary slips</h3>
            </div>
            {items.length === 0 ? (
              <p className="panel-copy">No salary slips for this run.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Slip</th>
                      <th>Employee</th>
                      <th>Payable days</th>
                      <th>Gross</th>
                      <th>Net</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.slip_code}</td>
                        <td>
                          {i.employee?.employee_code} · {i.employee?.full_name}
                        </td>
                        <td>{i.payable_days}</td>
                        <td>{formatPkr(i.gross_salary)}</td>
                        <td>{formatPkr(i.net_salary)}</td>
                        <td>
                          <span className="badge">{i.status}</span>
                        </td>
                        <td>
                          {i.status === 'generated' ? (
                            <Button
                              type="button"
                              disabled={payingId === i.id}
                              onClick={() => markPaid(i)}
                            >
                              Mark paid
                            </Button>
                          ) : (
                            i.paid_at || '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
