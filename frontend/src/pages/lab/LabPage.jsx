import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  admission_id: '',
  test_name: '',
  notes: '',
}

export default function LabPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [admissions, setAdmissions] = useState([])
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [resultDrafts, setResultDrafts] = useState({})

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, orderRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/lab-orders?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setOrders(orderRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load lab data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api('/lab-orders', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          test_name: form.test_name,
          notes: form.notes || null,
        },
      })
      toast.success(`Order ${data.data.order_code} created`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create lab order')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(order, status) {
    setUpdatingId(order.id)
    try {
      const body = { status }
      if (status === 'completed') {
        body.result_summary = resultDrafts[order.id] || order.result_summary || 'Completed'
      }
      const data = await api(`/lab-orders/${order.id}`, {
        method: 'PUT',
        body,
      })
      toast.success(`${data.data.order_code} → ${data.data.status}`)
      load()
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Support</p>
          <h2>Laboratory Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="admission_id">Active admission</label>
              <select
                id="admission_id"
                className="ui-select"
                required
                value={form.admission_id}
                onChange={(e) => setField('admission_id', e.target.value)}
              >
                <option value="">Select admission</option>
                {admissions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.admission_code} · {a.patient?.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="test_name">Test name</label>
              <input
                id="test_name"
                className="ui-input"
                required
                value={form.test_name}
                onChange={(e) => setField('test_name', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="notes">Notes</label>
              <input
                id="notes"
                className="ui-input"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving...' : 'Create lab order'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Lab orders</h3>
            </div>
            {orders.length === 0 ? (
              <p className="panel-copy">No lab orders yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Test</th>
                      <th>Status</th>
                      <th>Result</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.order_code}</td>
                        <td>
                          {o.patient?.patient_code} · {o.patient?.full_name}
                        </td>
                        <td>{o.test_name}</td>
                        <td>
                          <span className="badge">{o.status}</span>
                        </td>
                        <td>
                          {o.status === 'completed' ? (
                            o.result_summary || '—'
                          ) : o.status === 'cancelled' ? (
                            '—'
                          ) : (
                            <input
                              className="ui-input"
                              value={resultDrafts[o.id] ?? ''}
                              onChange={(e) =>
                                setResultDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))
                              }
                              placeholder="Result"
                            />
                          )}
                        </td>
                        <td>
                          <div className="page-actions">
                            {o.status === 'pending' && (
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={updatingId === o.id}
                                onClick={() => updateStatus(o, 'sample_collected')}
                              >
                                Sample
                              </Button>
                            )}
                            {(o.status === 'pending' || o.status === 'sample_collected') && (
                              <Button
                                type="button"
                                disabled={updatingId === o.id}
                                onClick={() => updateStatus(o, 'completed')}
                              >
                                Complete
                              </Button>
                            )}
                          </div>
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
