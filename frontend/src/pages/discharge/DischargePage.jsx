import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  admission_id: '',
  final_summary: '',
  aftercare_instructions: '',
  follow_up_date: '',
  belongings_handover: '',
  family_handover: '',
  fee_clearance_notes: '',
}

export default function DischargePage() {
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role_slug === 'admin'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [discharges, setDischarges] = useState([])
  const [form, setForm] = useState(emptyForm)
  const backTo = location.state?.backTo

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, disRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/discharges?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setDischarges(disRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load discharge data')
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
      if (isAdmin) {
        const data = await api('/discharges', {
          method: 'POST',
          body: {
            admission_id: Number(form.admission_id),
            final_summary: form.final_summary || null,
            aftercare_instructions: form.aftercare_instructions || null,
            follow_up_date: form.follow_up_date || null,
            belongings_handover: form.belongings_handover || null,
            family_handover: form.family_handover || null,
            fee_clearance_notes: form.fee_clearance_notes || null,
          },
        })
        toast.success(`Discharge ${data.data.discharge_code} completed`)
      } else {
        await api('/discharges/request', {
          method: 'POST',
          body: {
            admission_id: Number(form.admission_id),
            final_summary: form.final_summary || null,
          },
        })
        toast.success('Discharge requested — waiting for admin')
      }
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Discharge failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Discharge & Aftercare</h2>
        </div>
        {backTo ? (
          <div className="page-actions">
            <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>Back</Link>
          </div>
        ) : null}
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field full">
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
                    {a.admission_code} · {a.patient?.full_name} · {a.bed?.bed_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field full">
              <label htmlFor="final_summary">Final summary</label>
              <input
                id="final_summary"
                className="ui-input"
                value={form.final_summary}
                onChange={(e) => setField('final_summary', e.target.value)}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="aftercare_instructions">Aftercare instructions</label>
              <input
                id="aftercare_instructions"
                className="ui-input"
                value={form.aftercare_instructions}
                onChange={(e) => setField('aftercare_instructions', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="follow_up_date">Follow-up date</label>
              <input
                id="follow_up_date"
                type="date"
                className="ui-input"
                value={form.follow_up_date}
                onChange={(e) => setField('follow_up_date', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="fee_clearance_notes">Fee clearance</label>
              <input
                id="fee_clearance_notes"
                className="ui-input"
                value={form.fee_clearance_notes}
                onChange={(e) => setField('fee_clearance_notes', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="belongings_handover">Belongings handover</label>
              <input
                id="belongings_handover"
                className="ui-input"
                value={form.belongings_handover}
                onChange={(e) => setField('belongings_handover', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="family_handover">Family handover</label>
              <input
                id="family_handover"
                className="ui-input"
                value={form.family_handover}
                onChange={(e) => setField('family_handover', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving...' : isAdmin ? 'Confirm discharge' : 'Request discharge'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent discharges</h3>
            </div>
            {discharges.length === 0 ? (
              <p className="panel-copy">No discharges yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Admission</th>
                      <th>Follow-up</th>
                      <th>Discharged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discharges.map((d) => (
                      <tr key={d.id}>
                        <td>{d.discharge_code}</td>
                        <td>
                          {d.patient?.patient_code} · {d.patient?.full_name}
                        </td>
                        <td>{d.admission?.admission_code}</td>
                        <td>{d.follow_up_date || '—'}</td>
                        <td>{d.discharged_at}</td>
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
