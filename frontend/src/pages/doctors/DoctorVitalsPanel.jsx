import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { currentYearMonthPlain } from '../../components/dashboard/DateRangeFilter'
import Modal from '../../components/ui/Modal'
import { SkeletonCards } from '../../components/ui/Skeleton'

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

const CONDITION_TABS = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'serious', label: 'Critical' },
  { value: 'watch', label: 'Watch' },
  { value: 'normal', label: 'Normal' },
]

const CURRENT_YM = currentYearMonthPlain()

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

function badgeClass(level) {
  if (level === 'emergency') return 'badge badge-emergency'
  if (level === 'serious') return 'badge badge-danger'
  if (level === 'watch') return 'badge badge-warn'
  if (level === 'normal') return 'badge badge-ok'
  return 'badge'
}

function conditionLabel(level) {
  if (level === 'serious') return 'Critical'
  if (level === 'emergency') return 'Emergency'
  if (level === 'watch') return 'Watch'
  if (level === 'normal') return 'Normal'
  return level || '—'
}

function vitalsLine(note) {
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
  ].filter(Boolean).join(' · ') || '—'
}

export default function DoctorVitalsPanel({ focusNoteId = '' }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCondition = searchParams.get('condition') || 'emergency'
  const activeCondition = CONDITION_TABS.some((t) => t.value === requestedCondition)
    ? requestedCondition
    : 'emergency'

  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [year, setYear] = useState(CURRENT_YM.year)
  const [month, setMonth] = useState(CURRENT_YM.month)
  const [date, setDate] = useState('')
  const [years, setYears] = useState([Number(CURRENT_YM.year)])
  const [counts, setCounts] = useState({ emergency: 0, serious: 0, watch: 0, normal: 0 })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  async function load() {
    setLoading(true)
    try {
      const q = new URLSearchParams({ board: '1', condition: activeCondition })
      if (debounced) q.set('search', debounced)
      if (date) {
        q.set('date', date)
      } else {
        if (year) q.set('year', String(year))
        if (month) q.set('month', String(month))
      }
      const res = await api(`/nursing-notes?${q}`)
      const rows = res.data || []
      setNotes(rows)
      if (Array.isArray(res.meta?.available_years) && res.meta.available_years.length) {
        setYears(res.meta.available_years)
      }
      if (res.meta?.condition_counts) {
        setCounts({
          emergency: Number(res.meta.condition_counts.emergency || 0),
          serious: Number(res.meta.condition_counts.serious || 0),
          watch: Number(res.meta.condition_counts.watch || 0),
          normal: Number(res.meta.condition_counts.normal || 0),
        })
      }
      if (focusNoteId) {
        const hit = rows.find((n) => String(n.id) === String(focusNoteId))
        if (hit) setSelected(hit)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load vitals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [debounced, year, month, date, activeCondition, focusNoteId])

  function setConditionTab(value) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'vitals')
    next.set('condition', value)
    next.delete('note')
    setSearchParams(next, { replace: true })
    setSelected(null)
  }

  const emptyCopy = useMemo(() => {
    const label = CONDITION_TABS.find((t) => t.value === activeCondition)?.label || 'this'
    return `No ${label.toLowerCase()} patients for this filter.`
  }, [activeCondition])

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Patient conditions</h3>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Patient condition">
        {CONDITION_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeCondition === tab.value}
            className={`page-tab${activeCondition === tab.value ? ' is-active' : ''}`}
            onClick={() => setConditionTab(tab.value)}
          >
            {tab.label} ({counts[tab.value] ?? 0})
          </button>
        ))}
      </div>

      <div className="list-toolbar petty-list-toolbar">
        <input
          className="ui-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or code"
          aria-label="Search vitals"
        />
        <select
          className="ui-select"
          value={year}
          onChange={(e) => {
            setYear(e.target.value)
            setDate('')
          }}
          aria-label="Year"
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select
          className="ui-select"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setDate('')
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
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            if (e.target.value) {
              setYear('')
              setMonth('')
            }
          }}
          aria-label="Date"
        />
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : notes.length === 0 ? (
        <p className="panel-copy">{emptyCopy}</p>
      ) : (
        <div className="entity-card-grid">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={`entity-card fees-click-card${String(focusNoteId) === String(note.id) ? ' is-row-focus' : ''}`}
              onClick={() => setSelected(note)}
            >
              <div className="entity-card-top">
                <div>
                  <p className="entity-card-code">{note.patient?.patient_code || note.admission?.admission_code || '—'}</p>
                  <h3>{note.patient?.full_name || 'Patient'}</h3>
                </div>
                <span className={badgeClass(note.condition)}>{conditionLabel(note.condition)}</span>
              </div>
              <dl className="entity-card-meta">
                <div>
                  <dt>Vitals</dt>
                  <dd>{vitalsLine(note)}</dd>
                </div>
                <div>
                  <dt>Nurse</dt>
                  <dd>{note.created_by_name || '—'}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd>{formatWhen(note.recorded_at || note.created_at)}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        title={selected?.patient?.full_name || 'Patient vitals'}
        onClose={() => setSelected(null)}
        size="lg"
        cancelLabel="Close"
        confirmLabel="Prescribe"
        onConfirm={() => {
          const admissionId = selected?.admission?.id
          setSelected(null)
          if (admissionId) {
            navigate(`/app/doctors?tab=prescribe&admission_id=${admissionId}`)
          } else {
            navigate('/app/doctors?tab=prescribe')
          }
        }}
      >
        {selected ? (
          <div className="vitals-detail">
            <dl className="entity-card-meta">
              <div>
                <dt>Code</dt>
                <dd>{selected.patient?.patient_code || '—'}</dd>
              </div>
              <div>
                <dt>Admission</dt>
                <dd>{selected.admission?.admission_code || '—'}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>
                  <span className={badgeClass(selected.condition)}>
                    {conditionLabel(selected.condition)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Reasons</dt>
                <dd>{selected.condition_reasons?.length ? selected.condition_reasons.join(' · ') : '—'}</dd>
              </div>
              <div>
                <dt>Vitals</dt>
                <dd>{vitalsLine(selected)}</dd>
              </div>
              <div>
                <dt>Mood</dt>
                <dd>{selected.mood || '—'}</dd>
              </div>
              <div>
                <dt>Sleep</dt>
                <dd>{selected.sleep_quality || '—'}</dd>
              </div>
              <div>
                <dt>Appetite</dt>
                <dd>{selected.appetite || '—'}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{selected.observations || '—'}</dd>
              </div>
              <div>
                <dt>Interventions</dt>
                <dd>{selected.interventions || '—'}</dd>
              </div>
              <div>
                <dt>Nurse</dt>
                <dd>{selected.created_by_name || '—'}</dd>
              </div>
              <div>
                <dt>Shift</dt>
                <dd>{selected.shift || '—'}</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>{formatWhen(selected.recorded_at || selected.created_at)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
