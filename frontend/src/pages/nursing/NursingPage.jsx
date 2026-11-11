import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const SHIFTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

const emptyForm = {
  admission_id: '',
  shift: 'morning',
  temperature: '',
  pulse: '',
  bp_systolic: '',
  bp_diastolic: '',
  spo2: '',
  weight_kg: '',
  mood: '',
  sleep_quality: '',
  appetite: '',
  observations: '',
  interventions: '',
  status: 'recorded',
}

export default function NursingPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, noteRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/nursing-notes?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setNotes(noteRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load nursing data')
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
      const data = await api('/nursing-notes', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          shift: form.shift,
          temperature: form.temperature ? Number(form.temperature) : null,
          pulse: form.pulse ? Number(form.pulse) : null,
          bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
          bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
          spo2: form.spo2 ? Number(form.spo2) : null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          mood: form.mood || null,
          sleep_quality: form.sleep_quality || null,
          appetite: form.appetite || null,
          observations: form.observations || null,
          interventions: form.interventions || null,
          status: form.status || 'recorded',
        },
      })
      toast.success(`Note ${data.data.note_code} recorded`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save nursing note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Nursing Management</h2>
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
              <label htmlFor="shift">Shift</label>
              <select
                id="shift"
                className="ui-select"
                value={form.shift}
                onChange={(e) => setField('shift', e.target.value)}
              >
                {SHIFTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="temperature">Temp (°C)</label>
              <input
                id="temperature"
                className="ui-input"
                type="number"
                step="0.1"
                value={form.temperature}
                onChange={(e) => setField('temperature', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="pulse">Pulse</label>
              <input
                id="pulse"
                className="ui-input"
                type="number"
                value={form.pulse}
                onChange={(e) => setField('pulse', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="bp_systolic">BP systolic</label>
              <input
                id="bp_systolic"
                className="ui-input"
                type="number"
                value={form.bp_systolic}
                onChange={(e) => setField('bp_systolic', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="bp_diastolic">BP diastolic</label>
              <input
                id="bp_diastolic"
                className="ui-input"
                type="number"
                value={form.bp_diastolic}
                onChange={(e) => setField('bp_diastolic', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="spo2">SpO2 (%)</label>
              <input
                id="spo2"
                className="ui-input"
                type="number"
                value={form.spo2}
                onChange={(e) => setField('spo2', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="weight_kg">Weight (kg)</label>
              <input
                id="weight_kg"
                className="ui-input"
                type="number"
                step="0.1"
                value={form.weight_kg}
                onChange={(e) => setField('weight_kg', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="mood">Mood</label>
              <input
                id="mood"
                className="ui-input"
                value={form.mood}
                onChange={(e) => setField('mood', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="sleep_quality">Sleep</label>
              <input
                id="sleep_quality"
                className="ui-input"
                value={form.sleep_quality}
                onChange={(e) => setField('sleep_quality', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="appetite">Appetite</label>
              <input
                id="appetite"
                className="ui-input"
                value={form.appetite}
                onChange={(e) => setField('appetite', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                className="ui-select"
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <option value="recorded">Recorded</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>

            <div className="ui-field full">
              <label htmlFor="observations">Observations</label>
              <input
                id="observations"
                className="ui-input"
                value={form.observations}
                onChange={(e) => setField('observations', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="interventions">Interventions</label>
              <input
                id="interventions"
                className="ui-input"
                value={form.interventions}
                onChange={(e) => setField('interventions', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving...' : 'Record nursing note'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent nursing notes</h3>
            </div>
            {notes.length === 0 ? (
              <p className="panel-copy">No nursing notes yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Shift</th>
                      <th>Vitals</th>
                      <th>Status</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((n) => (
                      <tr key={n.id}>
                        <td>{n.note_code}</td>
                        <td>
                          {n.patient?.patient_code} · {n.patient?.full_name}
                        </td>
                        <td>
                          <span className="badge">{n.shift}</span>
                        </td>
                        <td>
                          {[
                            n.temperature != null ? `${n.temperature}°C` : null,
                            n.pulse != null ? `P ${n.pulse}` : null,
                            n.bp || null,
                            n.spo2 != null ? `SpO2 ${n.spo2}%` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                        <td>
                          <span className="badge">{n.status}</span>
                        </td>
                        <td>{n.recorded_at}</td>
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
