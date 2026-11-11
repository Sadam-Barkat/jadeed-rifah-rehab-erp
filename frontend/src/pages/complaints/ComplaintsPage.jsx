import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  type: 'complaint',
  title: '',
  description: '',
  reported_by_name: '',
  reporter_phone: '',
  severity: 'medium',
}

export default function ComplaintsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const res = await api('/complaints?per_page=20')
      setRows(res.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load complaints')
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
      const data = await api('/complaints', {
        method: 'POST',
        body: {
          type: form.type,
          title: form.title,
          description: form.description,
          reported_by_name: form.reported_by_name || null,
          reporter_phone: form.reporter_phone || null,
          severity: form.severity,
        },
      })
      toast.success(`${data.data.complaint_code} recorded`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(row, status) {
    setUpdatingId(row.id)
    try {
      const data = await api(`/complaints/${row.id}`, {
        method: 'PUT',
        body: {
          status,
          action_taken: status === 'resolved' ? (row.action_taken || 'Resolved') : row.action_taken,
        },
      })
      toast.success(`${data.data.complaint_code} → ${data.data.status}`)
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
          <p className="eyebrow">Compliance</p>
          <h2>Complaints & Incidents</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="type">Type</label>
              <select id="type" className="ui-select" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="complaint">Complaint</option>
                <option value="incident">Incident</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="severity">Severity</label>
              <select id="severity" className="ui-select" value={form.severity} onChange={(e) => setField('severity', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="title">Title</label>
              <input id="title" className="ui-input" required value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="description">Description</label>
              <input id="description" className="ui-input" required value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="reported_by_name">Reported by</label>
              <input id="reported_by_name" className="ui-input" value={form.reported_by_name} onChange={(e) => setField('reported_by_name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="reporter_phone">Phone</label>
              <input id="reporter_phone" className="ui-input" value={form.reporter_phone} onChange={(e) => setField('reporter_phone', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Recent records</h3></div>
            {rows.length === 0 ? (
              <p className="panel-copy">No complaints or incidents yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.complaint_code}</td>
                        <td><span className="badge">{r.type}</span></td>
                        <td>{r.title}</td>
                        <td>{r.severity}</td>
                        <td><span className="badge">{r.status}</span></td>
                        <td>
                          <div className="page-actions">
                            {r.status === 'open' && (
                              <Button type="button" variant="secondary" disabled={updatingId === r.id} onClick={() => updateStatus(r, 'in_progress')}>
                                Start
                              </Button>
                            )}
                            {(r.status === 'open' || r.status === 'in_progress') && (
                              <Button type="button" disabled={updatingId === r.id} onClick={() => updateStatus(r, 'resolved')}>
                                Resolve
                              </Button>
                            )}
                            {(r.status === 'resolved' || r.status === 'closed') && (r.resolved_at || '—')}
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
