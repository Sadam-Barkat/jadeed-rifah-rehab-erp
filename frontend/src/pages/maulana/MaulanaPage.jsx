import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ScrollSelect from '../../components/ui/ScrollSelect'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { currentYearMonthPlain } from '../../components/dashboard/DateRangeFilter'
import '../pages.css'

const SESSION_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'group', label: 'Group' },
  { value: 'family', label: 'Family' },
  { value: 'talk', label: 'Talk' },
]

const MONTH_OPTIONS = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
]

const emptyForm = {
  admission_ids: [],
  session_type: 'individual',
  duration_minutes: '30',
  topic: '',
  guidance: '',
  next_session_date: '',
}

function isMultiType(type) {
  return type === 'group' || type === 'family'
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

function formatDay(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function typeLabel(type) {
  return SESSION_TYPES.find((t) => t.value === type)?.label || type || '—'
}

function groupByCode(rows, extraKey = '') {
  const map = new Map()
  rows.forEach((row) => {
    const key = `${row.session_code || row.id}${extraKey ? `|${row[extraKey] || ''}` : ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        mode: extraKey === 'next_session_date' ? 'upcoming' : 'completed',
        session_code: row.session_code,
        session_type: row.session_type,
        next_session_date: row.next_session_date,
        topic: row.topic,
        guidance: row.guidance,
        duration_minutes: row.duration_minutes,
        created_by: row.created_by,
        session_at: row.session_at,
        status: row.status || 'completed',
        patients: [],
      })
    }
    const entry = map.get(key)
    entry.patients.push({
      id: row.patient?.id,
      name: row.patient?.full_name || row.patient?.patient_code || 'Patient',
      code: row.patient?.patient_code || '',
      admission_code: row.admission?.admission_code || '',
    })
  })
  return [...map.values()]
}

export default function MaulanaPage() {
  const { user } = useAuth()
  const canUse = (user?.modules || []).includes('spiritual')
  const ym = currentYearMonthPlain()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [patientQuery, setPatientQuery] = useState('')

  const [upcomingRows, setUpcomingRows] = useState([])
  const [completedRows, setCompletedRows] = useState([])
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)

  const [detail, setDetail] = useState(null)
  const [markNext, setMarkNext] = useState('')
  const [marking, setMarking] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [year, setYear] = useState(ym.year)
  const [month, setMonth] = useState(ym.month)
  const [date, setDate] = useState('')
  const [availableYears, setAvailableYears] = useState([Number(ym.year)])

  const multi = isMultiType(form.session_type)
  const upcomingGroups = useMemo(() => groupByCode(upcomingRows, 'next_session_date'), [upcomingRows])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const admissionOptions = useMemo(
    () =>
      admissions.map((a) => ({
        value: String(a.id),
        label: `${a.patient?.full_name || a.patient?.patient_code || 'Patient'} · ${a.admission_code}`,
      })),
    [admissions]
  )

  const filteredAdmissions = useMemo(() => {
    const q = patientQuery.trim().toLowerCase()
    if (!q) return admissions
    return admissions.filter((a) => {
      const hay = `${a.patient?.full_name || ''} ${a.patient?.patient_code || ''} ${a.admission_code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [admissions, patientQuery])

  const yearOptions = useMemo(() => {
    const set = new Set(availableYears.map(Number).filter(Boolean))
    set.add(Number(ym.year))
    return [...set].sort((a, b) => b - a)
  }, [availableYears, ym.year])

  async function loadAdmissions() {
    const data = await api('/admissions?status=active&per_page=50')
    setAdmissions(data.data || [])
  }

  async function loadUpcoming() {
    setUpcomingLoading(true)
    try {
      const params = new URLSearchParams({ scope: 'upcoming', per_page: '50', page: '1' })
      const first = await api(`/maulana-sessions?${params}`)
      const pageCount = Number(first.meta?.last_page || 1)
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => {
          const next = new URLSearchParams(params)
          next.set('page', String(i + 2))
          return api(`/maulana-sessions?${next}`)
        })
      )
      setUpcomingRows([...(first.data || []), ...rest.flatMap((p) => p.data || [])])
    } catch (err) {
      toast.error(err.message || 'Failed to load upcoming')
      setUpcomingRows([])
    } finally {
      setUpcomingLoading(false)
    }
  }

  async function loadCompleted() {
    setListLoading(true)
    try {
      const params = new URLSearchParams({ scope: 'completed', per_page: '50', page: '1' })
      if (date) params.set('date', date)
      else {
        if (year) params.set('year', year)
        if (month) params.set('month', month)
      }
      if (debouncedSearch) params.set('search', debouncedSearch)

      const first = await api(`/maulana-sessions?${params}`)
      const pageCount = Number(first.meta?.last_page || 1)
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => {
          const next = new URLSearchParams(params)
          next.set('page', String(i + 2))
          return api(`/maulana-sessions?${next}`)
        })
      )
      setCompletedRows([...(first.data || []), ...rest.flatMap((p) => p.data || [])])
      if (Array.isArray(first.meta?.available_years) && first.meta.available_years.length) {
        setAvailableYears(first.meta.available_years)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load history')
      setCompletedRows([])
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    if (!canUse) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadAdmissions(), loadUpcoming()])
      .catch((err) => toast.error(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [canUse])

  useEffect(() => {
    if (!canUse || loading) return
    loadCompleted()
  }, [canUse, loading, debouncedSearch, year, month, date])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setSessionType(value) {
    setForm((prev) => {
      const nextMulti = isMultiType(value)
      let ids = prev.admission_ids || []
      if (!nextMulti && ids.length > 1) ids = ids.slice(0, 1)
      return { ...prev, session_type: value, admission_ids: ids }
    })
    setPatientQuery('')
  }

  function toggleAdmission(id) {
    const key = String(id)
    setForm((prev) => {
      const set = new Set((prev.admission_ids || []).map(String))
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return { ...prev, admission_ids: [...set] }
    })
  }

  function openCompletedDetail(row) {
    const siblings = completedRows.filter((r) => r.session_code && r.session_code === row.session_code)
    const source = siblings.length ? siblings : [row]
    const grouped = groupByCode(source)[0]
    if (grouped) {
      setDetail({ ...grouped, mode: 'completed' })
      setMarkNext('')
    }
  }

  function openUpcomingDetail(group) {
    setDetail({ ...group, mode: 'upcoming' })
    setMarkNext('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const ids = (form.admission_ids || []).map(Number).filter(Boolean)
    if (!ids.length) {
      toast.error(multi ? 'Select at least 2 patients' : 'Select a patient')
      return
    }
    if (multi && ids.length < 2) {
      toast.error('Group or family needs at least 2 patients')
      return
    }
    if (!multi && ids.length !== 1) {
      toast.error('Select one patient')
      return
    }
    setSaving(true)
    try {
      const body = {
        admission_ids: ids,
        session_type: form.session_type || 'individual',
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        topic: form.topic.trim() || null,
        guidance: form.guidance.trim() || null,
        next_session_date: form.next_session_date || null,
        status: 'completed',
      }
      const data = await api('/maulana-sessions', { method: 'POST', body })
      toast.success(`Guidance ${data.data.session_code} saved`)
      setForm(emptyForm)
      setPatientQuery('')
      await Promise.all([loadUpcoming(), loadCompleted()])
    } catch (err) {
      toast.error(err.message || 'Failed to save guidance')
    } finally {
      setSaving(false)
    }
  }

  async function confirmMarkDone() {
    if (!detail?.session_code || detail.mode !== 'upcoming' || marking) return
    setMarking(true)
    try {
      await api('/maulana-sessions/mark-done', {
        method: 'POST',
        body: {
          session_code: detail.session_code,
          next_session_date: markNext || null,
        },
      })
      toast.success('Guidance marked done')
      setDetail(null)
      setMarkNext('')
      await Promise.all([loadUpcoming(), loadCompleted()])
    } catch (err) {
      toast.error(err.message || 'Failed to mark done')
    } finally {
      setMarking(false)
    }
  }

  if (!canUse) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Spiritual</p>
            <h2>Guidance</h2>
          </div>
        </div>
        <p className="panel-copy">You do not have access to spiritual guidance.</p>
      </div>
    )
  }

  const detailOpen = Boolean(detail)
  const isUpcomingDetail = detail?.mode === 'upcoming'

  return (
    <div className="page print-page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Spiritual</p>
          <h2>Guidance</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid no-print" onSubmit={handleSubmit}>
            <div className="panel-head full">
              <h3>Log new guidance</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="mau_type">Type</label>
              <select id="mau_type" className="ui-select" value={form.session_type} onChange={(e) => setSessionType(e.target.value)}>
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="mau_duration">Duration (minutes)</label>
              <input id="mau_duration" className="ui-input" type="number" min="5" max="480" step="5" value={form.duration_minutes} onChange={(e) => setField('duration_minutes', e.target.value)} />
            </div>
            {multi ? (
              <div className="ui-field full">
                <label htmlFor="mau_patient_search">Patients</label>
                <input id="mau_patient_search" className="ui-input" type="search" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search patients" />
                <div className="scroll-panel session-multi-pick" role="group" aria-label="Select patients">
                  {filteredAdmissions.length === 0 ? (
                    <p className="panel-copy">No admitted patients.</p>
                  ) : (
                    filteredAdmissions.map((a) => {
                      const id = String(a.id)
                      const checked = (form.admission_ids || []).map(String).includes(id)
                      return (
                        <label key={a.id} className="session-multi-option">
                          <input type="checkbox" checked={checked} onChange={() => toggleAdmission(a.id)} />
                          <span>
                            {a.patient?.full_name || a.patient?.patient_code || 'Patient'}
                            <small> · {a.admission_code}</small>
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="panel-copy">{(form.admission_ids || []).length} selected</p>
              </div>
            ) : (
              <div className="ui-field">
                <label htmlFor="mau_patient">Patient</label>
                <ScrollSelect
                  id="mau_patient"
                  value={(form.admission_ids || [])[0] || ''}
                  options={admissionOptions}
                  onChange={(value) => setField('admission_ids', value ? [value] : [])}
                  placeholder="Select admitted patient"
                  searchable
                  required
                />
              </div>
            )}
            <div className="ui-field">
              <label htmlFor="mau_next">Next session (optional)</label>
              <input id="mau_next" className="ui-input" type="date" value={form.next_session_date} onChange={(e) => setField('next_session_date', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="mau_topic">Topic</label>
              <input id="mau_topic" className="ui-input" value={form.topic} onChange={(e) => setField('topic', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="mau_guidance">Guidance notes</label>
              <textarea id="mau_guidance" className="ui-input" rows={3} value={form.guidance} onChange={(e) => setField('guidance', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving…' : 'Save guidance'}
              </Button>
            </div>
          </form>

          <section className="panel no-print">
            <div className="panel-head">
              <h3>Upcoming</h3>
            </div>
            {upcomingLoading ? (
              <SkeletonCards count={2} />
            ) : upcomingGroups.length === 0 ? (
              <p className="panel-copy">No upcoming guidance.</p>
            ) : (
              <div className="session-upcoming-list">
                {upcomingGroups.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    className="session-upcoming-card"
                    onClick={() => openUpcomingDetail(row)}
                  >
                    <span className="session-upcoming-main">
                      <strong>{formatDay(row.next_session_date)}</strong>
                      <span>{typeLabel(row.session_type)} · {row.patients.length} patient{row.patients.length === 1 ? '' : 's'}</span>
                    </span>
                    <span className="session-upcoming-meta">{row.session_code || 'Open'}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel print-stock-panel">
            <header className="print-dash-head">
              <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
              <h3>Completed spiritual guidance</h3>
            </header>
            <div className="panel-head no-print">
              <h3>Completed</h3>
            </div>
            <div className="list-toolbar no-print cook-log-toolbar">
              <input className="ui-input cook-log-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, topic, Maulana" aria-label="Search completed guidance" />
              <select className="ui-select" value={year} onChange={(e) => { setYear(e.target.value); setDate('') }} aria-label="Year">
                <option value="">Year</option>
                {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <select className="ui-select" value={month} onChange={(e) => { setMonth(e.target.value); setDate('') }} aria-label="Month">
                <option value="">Month</option>
                {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
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
              <Button type="button" variant="secondary" onClick={() => window.print()} disabled={listLoading}>Print</Button>
            </div>
            {listLoading ? (
              <SkeletonCards count={2} />
            ) : completedRows.length === 0 ? (
              <p className="panel-copy">No completed guidance for this filter.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel print-table-wrap session-history-scroll">
                <table className="data-table session-history-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Topic</th>
                      <th>Notes</th>
                      <th>Next</th>
                      <th>Maulana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedRows.map((row) => (
                      <tr key={row.id} className="is-clickable" onClick={() => openCompletedDetail(row)}>
                        <td>
                          {formatWhen(row.session_at)}
                          {row.session_code ? (<><br /><small>{row.session_code}</small></>) : null}
                        </td>
                        <td>
                          {row.patient?.full_name || '—'}
                          {row.patient?.patient_code ? (<><br /><small>{row.patient.patient_code}</small></>) : null}
                        </td>
                        <td>{typeLabel(row.session_type)}</td>
                        <td>{row.topic || '—'}</td>
                        <td>{row.guidance || '—'}</td>
                        <td>{formatDay(row.next_session_date)}</td>
                        <td>{row.created_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={detailOpen}
        title={isUpcomingDetail ? 'Upcoming guidance' : 'Completed guidance'}
        onClose={() => { if (!marking) { setDetail(null); setMarkNext('') } }}
        size="md"
        hideFooter={!isUpcomingDetail}
        cancelLabel="Close"
        confirmLabel={marking ? 'Saving…' : 'Mark done'}
        onConfirm={isUpcomingDetail ? confirmMarkDone : undefined}
      >
        {detail ? (
          <div className="session-detail">
            {!isUpcomingDetail ? (
              <p className="session-detail-status"><span className="badge badge-ok">Done</span></p>
            ) : null}
            <div className="session-detail-grid">
              <div><span>Code</span><strong>{detail.session_code || '—'}</strong></div>
              <div><span>Type</span><strong>{typeLabel(detail.session_type)}</strong></div>
              <div><span>{isUpcomingDetail ? 'Next date' : 'When'}</span><strong>{isUpcomingDetail ? formatDay(detail.next_session_date) : formatWhen(detail.session_at)}</strong></div>
              <div><span>Duration</span><strong>{detail.duration_minutes ? `${detail.duration_minutes} min` : '—'}</strong></div>
              <div><span>Maulana</span><strong>{detail.created_by || '—'}</strong></div>
              {!isUpcomingDetail ? (
                <div><span>Next</span><strong>{formatDay(detail.next_session_date)}</strong></div>
              ) : null}
            </div>
            <h4>Patients ({detail.patients.length})</h4>
            <ul className="session-upcoming-patients">
              {detail.patients.map((p, idx) => (
                <li key={`${p.id || p.code}-${idx}`}>
                  <strong>{p.name}</strong>
                  {p.code || p.admission_code ? <small>{[p.code, p.admission_code].filter(Boolean).join(' · ')}</small> : null}
                </li>
              ))}
            </ul>
            {detail.topic ? <p className="panel-copy"><strong>Topic:</strong> {detail.topic}</p> : null}
            {detail.guidance ? <p className="panel-copy"><strong>Notes:</strong> {detail.guidance}</p> : null}
            {isUpcomingDetail ? (
              <div className="ui-field" style={{ marginTop: 12 }}>
                <label htmlFor="mau_mark_next">Next session (optional)</label>
                <input id="mau_mark_next" className="ui-input" type="date" value={markNext} onChange={(e) => setMarkNext(e.target.value)} />
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
