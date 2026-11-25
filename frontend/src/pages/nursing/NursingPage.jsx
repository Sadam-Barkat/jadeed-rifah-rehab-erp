import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { currentYearMonthPlain } from '../../components/dashboard/DateRangeFilter'
import Button from '../../components/ui/Button'
import ScrollSelect from '../../components/ui/ScrollSelect'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

const SHIFTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

const LEVELS = [
  { value: '', label: '—' },
  { value: 'Good', label: 'Good' },
  { value: 'Fair', label: 'Fair' },
  { value: 'Poor', label: 'Poor' },
]

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const CURRENT_YM = currentYearMonthPlain()

const emptyForm = {
  admission_id: '',
  shift: 'morning',
  temperature: '',
  pulse: '',
  respiratory_rate: '',
  bp_systolic: '',
  bp_diastolic: '',
  spo2: '',
  weight_kg: '',
  blood_sugar_mg_dl: '',
  pain_score: '',
  mood: '',
  sleep_quality: '',
  appetite: '',
  observations: '',
  interventions: '',
  status: 'recorded',
}

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusLabel(status) {
  if (status === 'dispensed') return 'Ready'
  if (status === 'administered') return 'Given'
  if (status === 'pending') return 'Pending'
  return status || '—'
}

function vitalsSummary(note) {
  return [
    note.temperature != null ? `${note.temperature}°C` : null,
    note.pulse != null ? `P ${note.pulse}` : null,
    note.respiratory_rate != null ? `RR ${note.respiratory_rate}` : null,
    note.bp_systolic != null || note.bp_diastolic != null
      ? `BP ${note.bp_systolic || '—'}/${note.bp_diastolic || '—'}`
      : null,
    note.spo2 != null ? `SpO₂ ${note.spo2}%` : null,
    note.blood_sugar_mg_dl != null ? `BS ${note.blood_sugar_mg_dl}` : null,
    note.pain_score != null ? `Pain ${note.pain_score}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || '—'
}

export default function NursingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const canNurse = (user?.modules || []).includes('nursing')
  const requestedTab = searchParams.get('tab') || 'slips'
  const activeTab = ['slips', 'given', 'vitals'].includes(requestedTab) ? requestedTab : 'slips'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const [noteSearch, setNoteSearch] = useState('')
  const [debouncedNoteSearch, setDebouncedNoteSearch] = useState('')
  const [noteYear, setNoteYear] = useState(CURRENT_YM.year)
  const [noteMonth, setNoteMonth] = useState(CURRENT_YM.month)
  const [noteDate, setNoteDate] = useState('')
  const [noteNurseId, setNoteNurseId] = useState('')
  const [noteYears, setNoteYears] = useState([Number(CURRENT_YM.year)])
  const [nurses, setNurses] = useState([])

  const [slips, setSlips] = useState([])
  const [slipsLoading, setSlipsLoading] = useState(false)
  const [slipSearch, setSlipSearch] = useState('')
  const [debouncedSlipSearch, setDebouncedSlipSearch] = useState('')
  const [slipYear, setSlipYear] = useState(CURRENT_YM.year)
  const [slipMonth, setSlipMonth] = useState(CURRENT_YM.month)
  const [slipDate, setSlipDate] = useState('')
  const [slipDispenserId, setSlipDispenserId] = useState('')
  const [slipYears, setSlipYears] = useState([Number(CURRENT_YM.year)])
  const [dispensers, setDispensers] = useState([])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSlipSearch(slipSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [slipSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedNoteSearch(noteSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [noteSearch])

  async function loadAdmissions() {
    try {
      const admRes = await api('/admissions?status=active&per_page=50')
      setAdmissions(admRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load patients')
    }
  }

  async function loadNotes() {
    setNotesLoading(true)
    try {
      const q = new URLSearchParams({ per_page: '50' })
      if (debouncedNoteSearch) q.set('search', debouncedNoteSearch)
      if (noteNurseId) q.set('created_by', String(noteNurseId))
      if (noteDate) {
        q.set('date', noteDate)
      } else {
        if (noteYear) q.set('year', String(noteYear))
        if (noteMonth) q.set('month', String(noteMonth))
      }
      const noteRes = await api(`/nursing-notes?${q}`)
      setNotes(noteRes.data || [])
      if (Array.isArray(noteRes.meta?.available_years) && noteRes.meta.available_years.length) {
        setNoteYears(noteRes.meta.available_years)
      }
      if (Array.isArray(noteRes.meta?.nurses)) {
        setNurses(noteRes.meta.nurses)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load nursing notes')
    } finally {
      setNotesLoading(false)
      setLoading(false)
    }
  }

  async function loadSlips() {
    setSlipsLoading(true)
    try {
      const status = activeTab === 'given' ? 'administered' : 'dispensed'
      const q = new URLSearchParams({ per_page: '50', status })
      if (debouncedSlipSearch) q.set('search', debouncedSlipSearch)
      if (slipDispenserId) q.set('dispensed_by', String(slipDispenserId))
      if (slipDate) {
        q.set('date', slipDate)
      } else {
        if (slipYear) q.set('year', String(slipYear))
        if (slipMonth) q.set('month', String(slipMonth))
      }
      const res = await api(`/medicine-prescriptions?${q}`)
      setSlips(res.data || [])
      if (Array.isArray(res.meta?.available_years)) {
        setSlipYears(res.meta.available_years)
      }
      if (Array.isArray(res.meta?.dispensers)) {
        setDispensers(res.meta.dispensers)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load medicine slips')
    } finally {
      setSlipsLoading(false)
    }
  }

  useEffect(() => {
    if (!canNurse) return
    if (activeTab === 'vitals') {
      setLoading(true)
      loadAdmissions()
      loadNotes()
      return
    }
    setLoading(false)
    loadSlips()
  }, [canNurse, activeTab])

  useEffect(() => {
    if (!canNurse || activeTab === 'vitals') return
    loadSlips()
  }, [debouncedSlipSearch, slipYear, slipMonth, slipDate, slipDispenserId])

  useEffect(() => {
    if (!canNurse || activeTab !== 'vitals') return
    loadNotes()
  }, [debouncedNoteSearch, noteYear, noteMonth, noteDate, noteNurseId])

  if (!canNurse) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.admission_id) {
      toast.error('Select a patient')
      return
    }
    setSaving(true)
    try {
      const data = await api('/nursing-notes', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          shift: form.shift,
          temperature: form.temperature ? Number(form.temperature) : null,
          pulse: form.pulse ? Number(form.pulse) : null,
          respiratory_rate: form.respiratory_rate ? Number(form.respiratory_rate) : null,
          bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
          bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
          spo2: form.spo2 ? Number(form.spo2) : null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          blood_sugar_mg_dl: form.blood_sugar_mg_dl ? Number(form.blood_sugar_mg_dl) : null,
          pain_score: form.pain_score !== '' ? Number(form.pain_score) : null,
          mood: form.mood || null,
          sleep_quality: form.sleep_quality || null,
          appetite: form.appetite || null,
          observations: form.observations || null,
          interventions: form.interventions || null,
          status: form.status || 'recorded',
        },
      })
      toast.success(`Note ${data.data.note_code} recorded`)
      setForm({ ...emptyForm })
      loadNotes()
    } catch (err) {
      toast.error(err.message || 'Failed to save nursing note')
    } finally {
      setSaving(false)
    }
  }

  function openSlip(rx) {
    navigate(`/app/medicine-slips/${rx.id}`)
  }

  return (
    <div className="page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Nurse</h2>
        </div>
      </div>

      {activeTab === 'slips' || activeTab === 'given' ? (
        <section className="panel no-print">
          <div className="panel-head">
            <h3>{activeTab === 'given' ? 'Given medicines' : 'Medicine slips'}</h3>
          </div>
          <div className="list-toolbar petty-list-toolbar">
            <input
              className="ui-input"
              type="search"
              value={slipSearch}
              onChange={(e) => setSlipSearch(e.target.value)}
              placeholder="Search patient or code"
              aria-label="Search medicine slips"
            />
            <select
              className="ui-select"
              value={slipYear}
              onChange={(e) => {
                setSlipYear(e.target.value)
                setSlipDate('')
              }}
              aria-label="Year"
            >
              <option value="">Year</option>
              {slipYears.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <select
              className="ui-select"
              value={slipMonth}
              onChange={(e) => {
                setSlipMonth(e.target.value)
                setSlipDate('')
              }}
              aria-label="Month"
            >
              <option value="">Month</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              className="ui-input"
              type="date"
              value={slipDate}
              onChange={(e) => {
                setSlipDate(e.target.value)
                if (e.target.value) {
                  setSlipYear('')
                  setSlipMonth('')
                }
              }}
              aria-label="Date"
            />
            <select
              className="ui-select toolbar-filter-role"
              value={slipDispenserId}
              onChange={(e) => setSlipDispenserId(e.target.value)}
              aria-label="Dispenser"
            >
              <option value="">All dispensers</option>
              {dispensers.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>
          {slipsLoading ? (
            <SkeletonCards count={2} />
          ) : slips.length === 0 ? (
            <p className="panel-copy">
              {activeTab === 'given' ? 'No given medicines for this filter.' : 'No medicine slips waiting.'}
            </p>
          ) : (
            <div className="scroll-panel dash-scroll-panel pharmacy-orders-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Dispenser</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map((rx) => (
                    <tr key={rx.id} onClick={() => openSlip(rx)} style={{ cursor: 'pointer' }}>
                      <td>{rx.prescription_code}</td>
                      <td>{rx.patient?.full_name || rx.patient?.patient_code || '—'}</td>
                      <td>{rx.doctor?.full_name || rx.prescribed_by || '—'}</td>
                      <td>{rx.dispensed_by || '—'}</td>
                      <td>{rx.items?.length || 0}</td>
                      <td>
                        <span className={`badge ${rx.status === 'administered' ? 'badge-ok' : 'badge-warn'}`}>
                          {statusLabel(rx.status)}
                        </span>
                      </td>
                      <td>
                        {activeTab === 'given'
                          ? formatWhen(rx.administered_at || rx.dispensed_at)
                          : formatWhen(rx.dispensed_at || rx.prescribed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'vitals' ? (
        loading ? (
          <SkeletonCards count={2} />
        ) : (
          <>
            <form className="panel form-grid vitals-form no-print" onSubmit={handleSubmit}>
              <div className="panel-head full">
                <h3>Record vitals</h3>
              </div>

              <div className="ui-field vitals-span-2">
                <label htmlFor="admission_id">Patient</label>
                <ScrollSelect
                  id="admission_id"
                  required
                  searchable
                  value={form.admission_id}
                  placeholder="Select patient"
                  options={admissions.map((a) => ({
                    value: a.id,
                    label: `${a.patient?.full_name || 'Patient'} · ${a.patient?.patient_code || a.admission_code}`,
                  }))}
                  onChange={(value) => setField('admission_id', value)}
                />
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
                    <option key={s.value} value={s.value}>{s.label}</option>
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
                  min="30"
                  max="45"
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
                  min="20"
                  max="250"
                  value={form.pulse}
                  onChange={(e) => setField('pulse', e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label htmlFor="respiratory_rate">RR</label>
                <input
                  id="respiratory_rate"
                  className="ui-input"
                  type="number"
                  min="5"
                  max="60"
                  value={form.respiratory_rate}
                  onChange={(e) => setField('respiratory_rate', e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label htmlFor="spo2">SpO₂ (%)</label>
                <input
                  id="spo2"
                  className="ui-input"
                  type="number"
                  min="50"
                  max="100"
                  value={form.spo2}
                  onChange={(e) => setField('spo2', e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label>BP (mmHg)</label>
                <div className="vitals-bp">
                  <input
                    id="bp_systolic"
                    className="ui-input"
                    type="number"
                    min="50"
                    max="250"
                    placeholder="Sys"
                    aria-label="BP systolic"
                    value={form.bp_systolic}
                    onChange={(e) => setField('bp_systolic', e.target.value)}
                  />
                  <span className="vitals-bp-sep">/</span>
                  <input
                    id="bp_diastolic"
                    className="ui-input"
                    type="number"
                    min="30"
                    max="150"
                    placeholder="Dia"
                    aria-label="BP diastolic"
                    value={form.bp_diastolic}
                    onChange={(e) => setField('bp_diastolic', e.target.value)}
                  />
                </div>
              </div>

              <div className="ui-field">
                <label htmlFor="weight_kg">Weight (kg)</label>
                <input
                  id="weight_kg"
                  className="ui-input"
                  type="number"
                  step="0.1"
                  min="10"
                  max="300"
                  value={form.weight_kg}
                  onChange={(e) => setField('weight_kg', e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label htmlFor="blood_sugar_mg_dl">Blood sugar</label>
                <input
                  id="blood_sugar_mg_dl"
                  className="ui-input"
                  type="number"
                  min="20"
                  max="600"
                  value={form.blood_sugar_mg_dl}
                  onChange={(e) => setField('blood_sugar_mg_dl', e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label htmlFor="pain_score">Pain (0–10)</label>
                <input
                  id="pain_score"
                  className="ui-input"
                  type="number"
                  min="0"
                  max="10"
                  value={form.pain_score}
                  onChange={(e) => setField('pain_score', e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label htmlFor="mood">Mood</label>
                <select
                  id="mood"
                  className="ui-select"
                  value={form.mood}
                  onChange={(e) => setField('mood', e.target.value)}
                >
                  {LEVELS.map((o) => (
                    <option key={`mood-${o.value || 'x'}`} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="sleep_quality">Sleep</label>
                <select
                  id="sleep_quality"
                  className="ui-select"
                  value={form.sleep_quality}
                  onChange={(e) => setField('sleep_quality', e.target.value)}
                >
                  {LEVELS.map((o) => (
                    <option key={`sleep-${o.value || 'x'}`} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="ui-field">
                <label htmlFor="appetite">Appetite</label>
                <select
                  id="appetite"
                  className="ui-select"
                  value={form.appetite}
                  onChange={(e) => setField('appetite', e.target.value)}
                >
                  {LEVELS.map((o) => (
                    <option key={`app-${o.value || 'x'}`} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="ui-field vitals-span-2">
                <label htmlFor="interventions">Interventions</label>
                <textarea
                  id="interventions"
                  className="ui-input"
                  rows={1}
                  value={form.interventions}
                  onChange={(e) => setField('interventions', e.target.value)}
                />
              </div>

              <div className="ui-field full">
                <label htmlFor="observations">Notes</label>
                <textarea
                  id="observations"
                  className="ui-input"
                  rows={1}
                  value={form.observations}
                  onChange={(e) => setField('observations', e.target.value)}
                />
              </div>

              <div className="form-actions full">
                <Button type="submit" disabled={saving || !admissions.length}>
                  {saving ? 'Saving…' : 'Save vitals'}
                </Button>
              </div>
            </form>

            <section className="panel no-print">
              <div className="panel-head">
                <h3>Recent notes</h3>
              </div>
              <div className="list-toolbar petty-list-toolbar">
                <input
                  className="ui-input"
                  type="search"
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="Search patient or code"
                  aria-label="Search nursing notes"
                />
                <select
                  className="ui-select"
                  value={noteYear}
                  onChange={(e) => {
                    setNoteYear(e.target.value)
                    setNoteDate('')
                  }}
                  aria-label="Year"
                >
                  <option value="">Year</option>
                  {noteYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
                <select
                  className="ui-select"
                  value={noteMonth}
                  onChange={(e) => {
                    setNoteMonth(e.target.value)
                    setNoteDate('')
                  }}
                  aria-label="Month"
                >
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  value={noteDate}
                  onChange={(e) => {
                    setNoteDate(e.target.value)
                    if (e.target.value) {
                      setNoteYear('')
                      setNoteMonth('')
                    }
                  }}
                  aria-label="Date"
                />
                <select
                  className="ui-select"
                  value={noteNurseId}
                  onChange={(e) => setNoteNurseId(e.target.value)}
                  aria-label="Nurse"
                >
                  <option value="">All nurses</option>
                  {nurses.map((n) => (
                    <option key={n.id} value={String(n.id)}>{n.name}</option>
                  ))}
                </select>
              </div>
              {notesLoading ? (
                <SkeletonCards count={2} />
              ) : notes.length === 0 ? (
                <p className="panel-copy">No nursing notes for this filter.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel pharmacy-orders-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Patient</th>
                        <th>Nurse</th>
                        <th>Shift</th>
                        <th>Vitals</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.map((note) => (
                        <tr key={note.id}>
                          <td>{note.note_code}</td>
                          <td>{note.patient?.full_name || note.admission?.admission_code || '—'}</td>
                          <td>{note.created_by_name || '—'}</td>
                          <td>{note.shift || '—'}</td>
                          <td>{vitalsSummary(note)}</td>
                          <td>{formatWhen(note.recorded_at || note.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      ) : null}
    </div>
  )
}
