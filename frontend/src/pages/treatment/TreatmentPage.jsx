import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  admission_id: '',
  goals: '',
  daily_activities: '',
  progress_notes: '',
  aftercare_plan: '',
}

export default function TreatmentPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, planRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/treatment-plans?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setPlans(planRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load treatment data')
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
      const data = await api('/treatment-plans', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          goals: form.goals || null,
          daily_activities: form.daily_activities || null,
          progress_notes: form.progress_notes || null,
          aftercare_plan: form.aftercare_plan || null,
          status: 'active',
        },
      })
      toast.success(`Plan ${data.data.plan_code} created`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Treatment & Recovery</h2>
        </div>
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
                    {a.admission_code} · {a.patient?.full_name} · {a.program_days} days
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field full">
              <label htmlFor="goals">Goals</label>
              <input
                id="goals"
                className="ui-input"
                value={form.goals}
                onChange={(e) => setField('goals', e.target.value)}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="daily_activities">Daily activities</label>
              <input
                id="daily_activities"
                className="ui-input"
                value={form.daily_activities}
                onChange={(e) => setField('daily_activities', e.target.value)}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="progress_notes">Progress notes</label>
              <input
                id="progress_notes"
                className="ui-input"
                value={form.progress_notes}
                onChange={(e) => setField('progress_notes', e.target.value)}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="aftercare_plan">Aftercare plan</label>
              <input
                id="aftercare_plan"
                className="ui-input"
                value={form.aftercare_plan}
                onChange={(e) => setField('aftercare_plan', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving...' : 'Create treatment plan'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Treatment plans</h3>
            </div>
            {plans.length === 0 ? (
              <p className="panel-copy">No treatment plans yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Program</th>
                      <th>Dates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id}>
                        <td>{p.plan_code}</td>
                        <td>
                          {p.patient?.patient_code} · {p.patient?.full_name}
                        </td>
                        <td>{p.program_days} days</td>
                        <td>
                          {p.start_date} → {p.end_date || '—'}
                        </td>
                        <td>
                          <span className="badge">{p.status}</span>
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
