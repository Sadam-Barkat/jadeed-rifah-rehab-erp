import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkPhone, isValidPkPhone } from '../../lib/pk'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import ImageCaptureField from '../../components/ui/ImageCaptureField'
import Modal from '../../components/ui/Modal'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  known_key: '',
  admission_id: '',
  patient_id: '',
  visitor_name: '',
  party_size: '1',
  cnic: '',
  phone: '',
}

const VALID_TABS = new Set(['attendance', 'visitors'])

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

function patientOptionLabel(patient) {
  return `${patient.full_name || patient.patient_code} · ${patient.patient_code}`
}

export default function VisitorsPage() {
  const { user } = useAuth()
  const isGate = user?.role_slug === 'gatekeeper'
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'attendance'
  const tab = VALID_TABS.has(rawTab) ? rawTab : 'attendance'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAtt, setSavingAtt] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [patients, setPatients] = useState([])
  const [directory, setDirectory] = useState([])
  const [visits, setVisits] = useState([])
  const [present, setPresent] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [attCode, setAttCode] = useState('')
  const [attPhoto, setAttPhoto] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientListOpen, setPatientListOpen] = useState(false)
  const [activePatientIndex, setActivePatientIndex] = useState(-1)
  const [checkoutTarget, setCheckoutTarget] = useState(null)

  function setTab(id) {
    setSearchParams(id === 'attendance' ? { tab: 'attendance' } : { tab: id }, { replace: true })
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function loadPresent() {
    const res = await api('/attendance/day')
    setPresent(res.data || [])
  }

  async function loadDirectory() {
    const res = await api('/visitor-directory')
    setDirectory(res.data || [])
  }

  async function loadPatients() {
    const first = await api('/visitor-patients?per_page=100')
    const lastPage = Number(first.meta?.last_page || 1)
    const remaining = await Promise.all(
      Array.from({ length: Math.max(0, lastPage - 1) }, (_, index) =>
        api(`/visitor-patients?per_page=100&page=${index + 2}`)
      )
    )
    setPatients([...(first.data || []), ...remaining.flatMap((page) => page.data || [])])
  }

  async function loadAdmissions() {
    const response = await api('/admissions?status=active&per_page=100')
    setAdmissions(response.data || [])
  }

  async function loadVisits(q = debouncedSearch) {
    const params = new URLSearchParams({ per_page: '50' })
    if (q) params.set('search', q)
    const visRes = await api(`/visitor-logs?${params}`)
    setVisits(visRes.data || [])
  }

  async function load() {
    setLoading(true)
    try {
      if (tab === 'attendance') {
        await loadPresent()
      } else {
        await Promise.all([
          isGate ? loadPatients() : loadAdmissions(),
          loadVisits(debouncedSearch),
          loadDirectory(),
        ])
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tab, isGate])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (loading || tab !== 'visitors') return
    loadVisits(debouncedSearch).catch((err) => toast.error(err.message || 'Search failed'))
  }, [debouncedSearch])

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    const selected = patients.find((patient) => String(patient.id) === form.patient_id)
    if (!q || (selected && patientSearch === patientOptionLabel(selected))) return patients
    return patients.filter((patient) => {
      const name = (patient.full_name || '').toLowerCase()
      const code = (patient.patient_code || '').toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [patients, patientSearch, form.patient_id])

  const filteredAdmissions = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    if (!q) return admissions
    return admissions.filter((admission) => {
      const name = (admission.patient?.full_name || '').toLowerCase()
      const admissionCode = (admission.admission_code || '').toLowerCase()
      const patientCode = (admission.patient?.patient_code || '').toLowerCase()
      return name.includes(q) || admissionCode.includes(q) || patientCode.includes(q)
    })
  }, [admissions, patientSearch])

  function choosePatient(patient) {
    setField('patient_id', patient ? String(patient.id) : '')
    setPatientSearch(patient ? patientOptionLabel(patient) : '')
    setPatientListOpen(false)
    setActivePatientIndex(-1)
  }

  const sortedDirectory = useMemo(
    () =>
      [...directory].sort((a, b) =>
        String(a.visitor_name || '').localeCompare(String(b.visitor_name || ''), undefined, {
          sensitivity: 'base',
        })
      ),
    [directory]
  )

  function applyKnownVisitor(key) {
    if (!key) {
      setForm((prev) => ({ ...prev, known_key: '' }))
      return
    }
    const row = directory.find((d) => d.cnic_key === key)
    if (!row) {
      setField('known_key', '')
      return
    }
    setForm((prev) => ({
      ...prev,
      known_key: key,
      visitor_name: row.visitor_name || '',
      cnic: row.cnic || '',
      phone: row.phone || '',
    }))
  }

  function onCnicChange(value) {
    const key = digitsOnly(value)
    const match = key ? directory.find((d) => d.cnic_key === key) : null
    if (match) {
      setForm((prev) => ({
        ...prev,
        known_key: match.cnic_key,
        cnic: value,
        visitor_name: prev.visitor_name || match.visitor_name || '',
        phone: prev.phone || match.phone || '',
      }))
      return
    }
    setForm((prev) => ({
      ...prev,
      known_key: '',
      cnic: value,
    }))
  }

  async function handleStaffCheckIn(e) {
    e.preventDefault()
    if (!attPhoto) {
      toast.error('Staff photo is required')
      return
    }
    if (String(attCode).replace(/\D/g, '').length !== 4) {
      toast.error('Enter 4-digit attendance code')
      return
    }
    setSavingAtt(true)
    try {
      const fd = new FormData()
      fd.append('attendance_code', String(attCode).replace(/\D/g, '').slice(0, 4))
      fd.append('photo', attPhoto)
      const data = await api('/attendance/gate-check-in', { method: 'POST', body: fd })
      toast.success(data.message || 'Attendance marked')
      setAttCode('')
      setAttPhoto(null)
      await loadPresent()
    } catch (err) {
      toast.error(err.message || 'Attendance failed')
    } finally {
      setSavingAtt(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.visitor_name.trim() || !form.cnic.trim()) {
      toast.error('Name and CNIC are required')
      return
    }
    if (form.phone.trim() && !isValidPkPhone(form.phone)) {
      toast.error('Enter a valid phone (11 digits)')
      return
    }
    setSaving(true)
    try {
      const body = {
        visitor_name: form.visitor_name.trim(),
        party_size: Number(form.party_size) || 1,
        cnic: form.cnic.trim(),
        phone: form.phone.trim() || null,
      }
      if (isGate && form.patient_id) body.patient_id = Number(form.patient_id)
      if (!isGate && form.admission_id) body.admission_id = Number(form.admission_id)

      const data = await api('/visitor-logs', {
        method: 'POST',
        body,
      })
      toast.success(`Visitor ${data.data.visit_code} logged`)
      setForm(emptyForm)
      await Promise.all([loadVisits(debouncedSearch), loadDirectory()])
    } catch (err) {
      toast.error(err.message || 'Check-in failed')
    } finally {
      setSaving(false)
    }
  }

  async function confirmCheckout() {
    if (!checkoutTarget) return
    setCheckingOut(true)
    try {
      const data = await api(`/visitor-logs/${checkoutTarget.id}`, {
        method: 'PUT',
        body: { status: 'checked_out' },
      })
      toast.success(`${data.data.visit_code} checked out`)
      setCheckoutTarget(null)
      await loadVisits(debouncedSearch)
    } catch (err) {
      toast.error(err.message || 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className={`page${isGate ? ' finance-page' : ''}`}>
      {!isGate ? (
        <>
          <div className="page-header no-print">
            <div>
              <p className="eyebrow">Gate</p>
              <h2>Gate desk</h2>
            </div>
          </div>
          <div className="page-tabs no-print" role="tablist" aria-label="Gate tabs">
            <button
              type="button"
              role="tab"
              className={`page-tab ${tab === 'attendance' ? 'is-active' : ''}`}
              aria-selected={tab === 'attendance'}
              onClick={() => setTab('attendance')}
            >
              Staff Attendance
            </button>
            <button
              type="button"
              role="tab"
              className={`page-tab ${tab === 'visitors' ? 'is-active' : ''}`}
              aria-selected={tab === 'visitors'}
              onClick={() => setTab('visitors')}
            >
              Visitors
            </button>
          </div>
        </>
      ) : null}

      {loading ? (
        <SkeletonCards count={3} />
      ) : tab === 'attendance' ? (
        <>
          <form className="panel form-grid" onSubmit={handleStaffCheckIn}>
            <div className="ui-field">
              <label htmlFor="staff_att_code">Attendance code</label>
              <input
                id="staff_att_code"
                className="ui-input"
                inputMode="numeric"
                maxLength={4}
                required
                value={attCode}
                onChange={(e) => setAttCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
            <ImageCaptureField
              id="staff_att_photo"
              label="Staff photo"
              value={attPhoto}
              onChange={setAttPhoto}
              required
              cameraOnly
              facingMode="user"
              filenamePrefix="staff-attendance"
            />
            <div className="form-actions full">
              <Button type="submit" disabled={savingAtt}>
                {savingAtt ? 'Saving…' : 'Mark present'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Present today</h3>
            </div>
            {present.length === 0 ? (
              <p className="panel-copy">No staff checked in yet.</p>
            ) : (
              <div className="scroll-panel att-present-scroll">
                <div className="att-present-grid">
                  {present.map((p) => (
                    <article key={p.id} className="att-present-card">
                      {p.photo_url ? (
                        <a href={p.photo_url} target="_blank" rel="noreferrer">
                          <img src={p.photo_url} alt={p.staff?.name || 'Staff'} className="att-present-photo" />
                        </a>
                      ) : (
                        <div className="att-present-photo is-empty">No photo</div>
                      )}
                      <div className="att-present-meta">
                        <strong>{p.staff?.name || '—'}</strong>
                        <span>{p.staff?.role || '—'}</span>
                        <span>{p.check_in_at ? new Date(p.check_in_at).toLocaleTimeString() : '—'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field full">
              <label htmlFor="known_visitor">Known visitor</label>
              <select
                id="known_visitor"
                className="ui-select"
                value={form.known_key}
                onChange={(e) => applyKnownVisitor(e.target.value)}
              >
                <option value="">New visitor</option>
                {sortedDirectory.map((d) => (
                  <option key={d.cnic_key} value={d.cnic_key}>
                    {d.visitor_name} — {d.cnic}
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
              <label htmlFor="cnic">CNIC</label>
              <input
                id="cnic"
                className="ui-input"
                required
                value={form.cnic}
                onChange={(e) => onCnicChange(e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="party_size">Visitors</label>
              <select
                id="party_size"
                className="ui-select"
                value={form.party_size}
                onChange={(e) => setField('party_size', e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                className="ui-input"
                inputMode="numeric"
                maxLength={11}
                value={form.phone}
                onChange={(e) => setField('phone', formatPkPhone(e.target.value))}
              />
            </div>
            {isGate ? (
              <div className="ui-field visitor-patient-field">
                <label htmlFor="visitor_patient_search">Find patient</label>
                <div className={`visitor-patient-select${patientListOpen ? ' is-open' : ''}`}>
                  <input
                    id="visitor_patient_search"
                    className="ui-input"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={patientListOpen}
                    aria-controls="visitor-patient-options"
                    autoComplete="off"
                    value={patientSearch}
                    onFocus={() => setPatientListOpen(true)}
                    onChange={(event) => {
                      setPatientSearch(event.target.value)
                      setField('patient_id', '')
                      setActivePatientIndex(-1)
                      setPatientListOpen(true)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setPatientListOpen(true)
                        setActivePatientIndex((index) => Math.min(index + 1, filteredPatients.length - 1))
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setActivePatientIndex((index) => Math.max(index - 1, 0))
                      } else if (event.key === 'Enter' && patientListOpen && activePatientIndex >= 0) {
                        event.preventDefault()
                        choosePatient(filteredPatients[activePatientIndex])
                      } else if (event.key === 'Escape') {
                        setPatientListOpen(false)
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setPatientListOpen(false), 120)
                    }}
                    placeholder="Search by patient name or code, or select"
                  />
                  {patientListOpen ? (
                    <div className="visitor-patient-options" id="visitor-patient-options" role="listbox">
                      <button
                        type="button"
                        className="visitor-patient-option"
                        role="option"
                        aria-selected={!form.patient_id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choosePatient(null)}
                      >
                        No patient
                      </button>
                      {filteredPatients.map((patient, index) => (
                        <button
                          type="button"
                          key={patient.id}
                          className={`visitor-patient-option${activePatientIndex === index ? ' is-active' : ''}`}
                          role="option"
                          aria-selected={String(patient.id) === form.patient_id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => choosePatient(patient)}
                        >
                          {patientOptionLabel(patient)}
                        </button>
                      ))}
                      {filteredPatients.length === 0 ? (
                        <p className="visitor-patient-empty">No patients found.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="ui-field">
                  <label htmlFor="patient_search">Find patient</label>
                  <input
                    id="patient_search"
                    className="ui-input"
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                    placeholder="Search"
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="admission_id">Patient</label>
                  <select
                    id="admission_id"
                    className="ui-select"
                    value={form.admission_id}
                    onChange={(event) => setField('admission_id', event.target.value)}
                  >
                    <option value="">None</option>
                    {filteredAdmissions.map((admission) => (
                      <option key={admission.id} value={admission.id}>
                        {admission.patient?.full_name || admission.patient?.patient_code} — {admission.admission_code}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Log visitor'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className={`panel-head${isGate ? ' gate-visitor-log-head' : ''}`}>
              <h3>{isGate ? 'Recent visitor entries' : 'Visitor log'}</h3>
              <input
                className="ui-input panel-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search visitors"
              />
            </div>
            {visits.length === 0 ? (
              <p className="panel-copy">
                {isGate ? 'No visitor entries from the last 24 hours.' : 'No visitors yet.'}
              </p>
            ) : (
              <div className="scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Visitor</th>
                      <th>CNIC</th>
                      <th>Visitors</th>
                      <th>Patient</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td>{v.visit_code}</td>
                        <td>{v.visitor_name}</td>
                        <td>{v.cnic || '—'}</td>
                        <td>{v.party_size || 1}</td>
                        <td>{v.patient?.full_name || '—'}</td>
                        <td>
                          <span className="badge">{v.status === 'checked_in' ? 'Inside' : v.status}</span>
                        </td>
                        <td>
                          {v.status === 'checked_in' ? (
                            <Button type="button" variant="secondary" onClick={() => setCheckoutTarget(v)}>
                              Check out
                            </Button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <Modal
            open={!!checkoutTarget}
            title="Check out visitor"
            size="sm"
            onClose={() => (!checkingOut ? setCheckoutTarget(null) : null)}
            onConfirm={confirmCheckout}
            confirmLabel={checkingOut ? 'Checking out…' : 'Check out'}
            cancelLabel="Cancel"
            confirm
          >
            <p className="panel-copy">
              Check out {checkoutTarget?.visitor_name} ({checkoutTarget?.visit_code})?
            </p>
          </Modal>
        </>
      )}
    </div>
  )
}
