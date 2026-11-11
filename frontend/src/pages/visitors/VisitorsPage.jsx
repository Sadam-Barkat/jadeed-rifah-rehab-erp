import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  admission_id: '',
  visitor_name: '',
  relation: '',
  phone: '',
  cnic: '',
  purpose: '',
  items_brought: '',
  notes: '',
}

export default function VisitorsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [admissions, setAdmissions] = useState([])
  const [visits, setVisits] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, visRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/visitor-logs?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setVisits(visRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load visitors')
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
      const data = await api('/visitor-logs', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          visitor_name: form.visitor_name,
          relation: form.relation || null,
          phone: form.phone || null,
          cnic: form.cnic || null,
          purpose: form.purpose || null,
          items_brought: form.items_brought || null,
          notes: form.notes || null,
        },
      })
      toast.success(`Visitor ${data.data.visit_code} checked in`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Check-in failed')
    } finally {
      setSaving(false)
    }
  }

  async function checkOut(visit) {
    setUpdatingId(visit.id)
    try {
      const data = await api(`/visitor-logs/${visit.id}`, {
        method: 'PUT',
        body: { status: 'checked_out' },
      })
      toast.success(`${data.data.visit_code} checked out`)
      load()
    } catch (err) {
      toast.error(err.message || 'Check-out failed')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Family & Visitors</h2>
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
              <label htmlFor="visitor_name">Visitor name</label>
              <input
                id="visitor_name"
                className="ui-input"
                required
                value={form.visitor_name}
                onChange={(e) => setField('visitor_name', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="relation">Relation</label>
              <input
                id="relation"
                className="ui-input"
                value={form.relation}
                onChange={(e) => setField('relation', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                className="ui-input"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="cnic">CNIC</label>
              <input
                id="cnic"
                className="ui-input"
                value={form.cnic}
                onChange={(e) => setField('cnic', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="purpose">Purpose</label>
              <input
                id="purpose"
                className="ui-input"
                value={form.purpose}
                onChange={(e) => setField('purpose', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="items_brought">Items brought</label>
              <input
                id="items_brought"
                className="ui-input"
                value={form.items_brought}
                onChange={(e) => setField('items_brought', e.target.value)}
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
                {saving ? 'Saving...' : 'Check in visitor'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Visitor log</h3>
            </div>
            {visits.length === 0 ? (
              <p className="panel-copy">No visitor logs yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Visitor</th>
                      <th>Patient</th>
                      <th>Check-in</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td>{v.visit_code}</td>
                        <td>
                          {v.visitor_name}
                          {v.relation ? ` · ${v.relation}` : ''}
                        </td>
                        <td>
                          {v.patient?.patient_code} · {v.patient?.full_name}
                        </td>
                        <td>{v.check_in_at}</td>
                        <td>
                          <span className="badge">{v.status}</span>
                        </td>
                        <td>
                          {v.status === 'checked_in' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={updatingId === v.id}
                              onClick={() => checkOut(v)}
                            >
                              Check out
                            </Button>
                          ) : (
                            v.check_out_at || '—'
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
