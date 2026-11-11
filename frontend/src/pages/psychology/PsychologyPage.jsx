import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const SESSION_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'group', label: 'Group' },
  { value: 'family', label: 'Family' },
  { value: 'assessment', label: 'Assessment' },
]

const emptyForm = {
  admission_id: '',
  session_type: 'individual',
  duration_minutes: '45',
  mood_before: '',
  mood_after: '',
  topics: '',
  observations: '',
  homework: '',
  next_session_date: '',
}

export default function PsychologyPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [sessions, setSessions] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, sesRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/psychology-sessions?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setSessions(sesRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load psychology data')
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
      const data = await api('/psychology-sessions', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          session_type: form.session_type,
          duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
          mood_before: form.mood_before || null,
          mood_after: form.mood_after || null,
          topics: form.topics || null,
          observations: form.observations || null,
          homework: form.homework || null,
          next_session_date: form.next_session_date || null,
          status: 'completed',
        },
      })
      toast.success(`Session ${data.data.session_code} saved`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Psychology Management</h2>
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
              <label htmlFor="session_type">Session type</label>
              <select
                id="session_type"
                className="ui-select"
                value={form.session_type}
                onChange={(e) => setField('session_type', e.target.value)}
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="duration_minutes">Duration (min)</label>
              <input
                id="duration_minutes"
                className="ui-input"
                type="number"
                min="5"
                value={form.duration_minutes}
                onChange={(e) => setField('duration_minutes', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="next_session_date">Next session</label>
              <input
                id="next_session_date"
                className="ui-input"
                type="date"
                value={form.next_session_date}
                onChange={(e) => setField('next_session_date', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="mood_before">Mood before</label>
              <input
                id="mood_before"
                className="ui-input"
                value={form.mood_before}
                onChange={(e) => setField('mood_before', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="mood_after">Mood after</label>
              <input
                id="mood_after"
                className="ui-input"
                value={form.mood_after}
                onChange={(e) => setField('mood_after', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="topics">Topics</label>
              <input
                id="topics"
                className="ui-input"
                value={form.topics}
                onChange={(e) => setField('topics', e.target.value)}
              />
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
              <label htmlFor="homework">Homework</label>
              <input
                id="homework"
                className="ui-input"
                value={form.homework}
                onChange={(e) => setField('homework', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving...' : 'Save session'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent sessions</h3>
            </div>
            {sessions.length === 0 ? (
              <p className="panel-copy">No psychology sessions yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Mood</th>
                      <th>When</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.session_code}</td>
                        <td>
                          {s.patient?.patient_code} · {s.patient?.full_name}
                        </td>
                        <td>
                          <span className="badge">{s.session_type}</span>
                        </td>
                        <td>
                          {(s.mood_before || '—') + ' → ' + (s.mood_after || '—')}
                        </td>
                        <td>{s.session_at}</td>
                        <td>{s.created_by_name || '—'}</td>
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
