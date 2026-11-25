import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import DoctorVitalsPanel from './DoctorVitalsPanel'
import { api } from '../../lib/api'
import { printReportTable } from '../../lib/printReport'
import { isWithinUploadLimit, uploadTooLargeMessage } from '../../lib/uploadLimits'
import { useAuth } from '../../context/AuthContext'
import { DOCTOR_ROLE_LABELS } from '../../lib/clinicalDoctors'
import { currentYearMonthPlain } from '../../components/dashboard/DateRangeFilter'
import Button from '../../components/ui/Button'
import MedicineTypeahead from '../../components/ui/MedicineTypeahead'
import ScrollSelect from '../../components/ui/ScrollSelect'
import WhenToGiveField from '../../components/ui/WhenToGiveField'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const ROUND_TYPES = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'follow_up', label: 'Follow-up' },
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

const RX_TRACK_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'given', label: 'Given' },
]

const CURRENT_YM = currentYearMonthPlain()

const emptyRound = {
  admission_id: '',
  round_type: 'morning',
  vitals_summary: '',
  findings: '',
  orders: '',
  next_review_at: '',
}

const emptyRxLine = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  medicine_name: '',
  medicine_id: '',
  medicine_label: '',
  quantity: '1',
  dosage: '',
  frequency: '',
  instructions: '',
  unit: '',
  form: '',
})

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
  if (status === 'pending') return 'Pending'
  if (status === 'dispensed') return 'Dispensed'
  if (status === 'administered') return 'Given'
  if (status === 'cancelled') return 'Cancelled'
  return status || '—'
}

function statusBadgeClass(status) {
  if (status === 'pending') return 'badge badge-warn'
  if (status === 'dispensed') return 'badge badge-ok'
  if (status === 'administered') return 'badge badge-ok'
  return 'badge'
}

function nurseName(rx) {
  return rx.administered_by || rx.nurse?.name || '—'
}

function dispenserName(rx) {
  return rx.dispensed_by || rx.dispenser?.name || '—'
}

export default function DoctorsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') || 'vitals'
  const activeTab = ['vitals', 'prescribe', 'rounds'].includes(requestedTab) ? requestedTab : 'vitals'
  const preselectAdmissionId = searchParams.get('admission_id') || ''
  const preselectTrack = searchParams.get('track') || ''

  const [loading, setLoading] = useState(true)
  const [savingRound, setSavingRound] = useState(false)
  const [savingRx, setSavingRx] = useState(false)
  const [myDoctor, setMyDoctor] = useState(null)
  const [admissions, setAdmissions] = useState([])
  const [rounds, setRounds] = useState([])
  const [roundsLoading, setRoundsLoading] = useState(false)
  const [roundSearch, setRoundSearch] = useState('')
  const [debouncedRoundSearch, setDebouncedRoundSearch] = useState('')
  const [roundYear, setRoundYear] = useState(CURRENT_YM.year)
  const [roundMonth, setRoundMonth] = useState(CURRENT_YM.month)
  const [roundDate, setRoundDate] = useState('')
  const [roundTypeFilter, setRoundTypeFilter] = useState('')
  const [roundYears, setRoundYears] = useState([Number(CURRENT_YM.year)])
  const [roundForm, setRoundForm] = useState(emptyRound)
  const [rxAdmissionId, setRxAdmissionId] = useState('')
  const [rxMode, setRxMode] = useState('digital') // digital | handwritten
  const [rxLines, setRxLines] = useState([emptyRxLine()])
  const [rxPhoto, setRxPhoto] = useState(null)
  const rxPhotoRef = useRef(null)
  const rxLinesScrollRef = useRef(null)

  const [prescriptions, setPrescriptions] = useState([])
  const [rxListLoading, setRxListLoading] = useState(false)
  const [rxSearch, setRxSearch] = useState('')
  const [debouncedRxSearch, setDebouncedRxSearch] = useState('')
  const [rxYear, setRxYear] = useState(CURRENT_YM.year)
  const [rxMonth, setRxMonth] = useState(CURRENT_YM.month)
  const [rxDate, setRxDate] = useState('')
  const [rxTrack, setRxTrack] = useState(
    ['pending', 'dispensed', 'given'].includes(preselectTrack) ? preselectTrack : 'pending'
  )
  const [rxTrackCounts, setRxTrackCounts] = useState({ pending: 0, dispensed: 0, given: 0 })
  const [rxNurseFilter, setRxNurseFilter] = useState('')
  const [rxDispenserFilter, setRxDispenserFilter] = useState('')
  const [rxYears, setRxYears] = useState([Number(CURRENT_YM.year)])
  const [rxNurseOptions, setRxNurseOptions] = useState([])
  const [rxDispenserOptions, setRxDispenserOptions] = useState([])

  const roleTitle = DOCTOR_ROLE_LABELS[user?.role_slug] || 'Doctor'

  const admissionOptions = useMemo(
    () => admissions.map((a) => ({
      value: a.id,
      label: `${a.patient?.full_name || 'Patient'} · ${a.patient?.patient_code || a.admission_code}`,
    })),
    [admissions]
  )

  function setRoundField(key, value) {
    setRoundForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRxSearch(rxSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [rxSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRoundSearch(roundSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [roundSearch])

  useEffect(() => {
    if (preselectAdmissionId) setRxAdmissionId(String(preselectAdmissionId))
  }, [preselectAdmissionId])

  useEffect(() => {
    if (['pending', 'dispensed', 'given'].includes(preselectTrack)) {
      setRxTrack(preselectTrack)
    }
  }, [preselectTrack])

  async function loadWorkspace() {
    setLoading(true)
    try {
      const [docRes, admRes] = await Promise.all([
        api('/doctors?status=active&per_page=50'),
        api('/admissions?status=active&per_page=50'),
      ])
      const doctors = docRes.data || []
      const mine = doctors.find((d) => String(d.user_id) === String(user?.id))
        || doctors.find((d) => d.email && d.email === user?.email)
        || null
      setMyDoctor(mine)
      setAdmissions(admRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load doctor workspace')
    } finally {
      setLoading(false)
    }
  }

  async function loadRounds() {
    setRoundsLoading(true)
    try {
      const q = new URLSearchParams({ per_page: '50' })
      if (debouncedRoundSearch) q.set('search', debouncedRoundSearch)
      if (roundTypeFilter) q.set('round_type', roundTypeFilter)
      if (roundDate) {
        q.set('date', roundDate)
      } else {
        if (roundYear) q.set('year', String(roundYear))
        if (roundMonth) q.set('month', String(roundMonth))
      }
      if (myDoctor?.id) q.set('doctor_id', String(myDoctor.id))
      const res = await api(`/doctor-rounds?${q}`)
      setRounds(res.data || [])
      if (Array.isArray(res.meta?.available_years) && res.meta.available_years.length) {
        setRoundYears(res.meta.available_years)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load rounds')
    } finally {
      setRoundsLoading(false)
    }
  }

  async function loadMyPrescriptions() {
    setRxListLoading(true)
    try {
      const q = new URLSearchParams({ per_page: '50', track: rxTrack || 'pending' })
      if (debouncedRxSearch) q.set('search', debouncedRxSearch)
      if (rxTrack === 'given' && rxNurseFilter) q.set('nurse_id', String(rxNurseFilter))
      if (rxTrack === 'dispensed' && rxDispenserFilter) q.set('dispensed_by', String(rxDispenserFilter))
      if (rxDate) {
        q.set('date', rxDate)
      } else {
        if (rxYear) q.set('year', String(rxYear))
        if (rxMonth) q.set('month', String(rxMonth))
      }
      const res = await api(`/medicine-prescriptions?${q}`)
      setPrescriptions(res.data || [])
      if (Array.isArray(res.meta?.available_years) && res.meta.available_years.length) {
        setRxYears(res.meta.available_years)
      }
      if (Array.isArray(res.meta?.nurses)) {
        setRxNurseOptions(res.meta.nurses)
      }
      if (Array.isArray(res.meta?.dispensers)) {
        setRxDispenserOptions(res.meta.dispensers)
      }
      if (res.meta?.track_counts) {
        setRxTrackCounts({
          pending: Number(res.meta.track_counts.pending || 0),
          dispensed: Number(res.meta.track_counts.dispensed || 0),
          given: Number(res.meta.track_counts.given || 0),
        })
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load prescriptions')
    } finally {
      setRxListLoading(false)
    }
  }

  function setRxLine(index, patch) {
    setRxLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addRxLine() {
    setRxLines((prev) => [emptyRxLine(), ...prev])
    requestAnimationFrame(() => {
      if (rxLinesScrollRef.current) rxLinesScrollRef.current.scrollTop = 0
    })
  }

  function removeRxLine(index) {
    setRxLines((prev) => (prev.length <= 1 ? [emptyRxLine()] : prev.filter((_, i) => i !== index)))
  }

  useEffect(() => {
    if (activeTab === 'vitals') {
      setLoading(false)
      return
    }
    loadWorkspace()
  }, [activeTab, user?.id])

  useEffect(() => {
    if (activeTab !== 'prescribe') return
    loadMyPrescriptions()
  }, [activeTab, debouncedRxSearch, rxYear, rxMonth, rxDate, rxTrack, rxNurseFilter, rxDispenserFilter])

  useEffect(() => {
    if (activeTab !== 'rounds') return
    if (loading) return
    loadRounds()
  }, [activeTab, loading, myDoctor?.id, debouncedRoundSearch, roundYear, roundMonth, roundDate, roundTypeFilter])

  function changeRxTrack(next) {
    setRxTrack(next)
    setRxNurseFilter('')
    setRxDispenserFilter('')
  }

  async function handleRoundSubmit(e) {
    e.preventDefault()
    if (!myDoctor?.id) {
      toast.error('Your doctor profile is not linked. Ask Admin to link your staff account.')
      return
    }
    if (!roundForm.admission_id) {
      toast.error('Select a patient')
      return
    }
    setSavingRound(true)
    try {
      const data = await api('/doctor-rounds', {
        method: 'POST',
        body: {
          doctor_id: Number(myDoctor.id),
          admission_id: Number(roundForm.admission_id),
          round_type: roundForm.round_type,
          vitals_summary: roundForm.vitals_summary || null,
          findings: roundForm.findings || null,
          orders: roundForm.orders || null,
          next_review_at: roundForm.next_review_at || null,
          status: 'completed',
        },
      })
      toast.success(`Round ${data.data.round_code} saved`)
      setRoundForm({ ...emptyRound })
      loadRounds()
    } catch (err) {
      toast.error(err.message || 'Failed to save round')
    } finally {
      setSavingRound(false)
    }
  }

  async function handlePrescribe(e) {
    e.preventDefault()
    if (!rxAdmissionId) {
      toast.error('Select a patient')
      return
    }

    if (rxMode === 'handwritten') {
      if (!rxPhoto) {
        toast.error('Upload a handwritten prescription photo')
        return
      }
      if (!isWithinUploadLimit(rxPhoto)) {
        toast.error(uploadTooLargeMessage('Prescription image'))
        return
      }
    }

    const items = rxMode === 'digital'
      ? rxLines
        .filter((line) => line.medicine_id && Number(line.quantity) > 0)
        .map((line) => ({
          medicine_id: Number(line.medicine_id),
          medicine_name: line.medicine_name,
          quantity: Number(line.quantity),
          dosage: line.dosage || null,
          frequency: line.frequency || null,
          instructions: line.instructions || null,
        }))
      : []

    if (rxMode === 'digital') {
      if (rxLines.some((line) => line.medicine_name.trim() && !line.medicine_id)) {
        toast.error('Select each medicine from the list')
        return
      }
      if (!items.length) {
        toast.error('Add at least one medicine from the list')
        return
      }
    }

    setSavingRx(true)
    try {
      const body = new FormData()
      body.append('admission_id', String(Number(rxAdmissionId)))
      items.forEach((item, index) => {
        body.append(`items[${index}][medicine_id]`, String(item.medicine_id))
        body.append(`items[${index}][medicine_name]`, item.medicine_name)
        body.append(`items[${index}][quantity]`, String(item.quantity))
        if (item.dosage) body.append(`items[${index}][dosage]`, item.dosage)
        if (item.frequency) body.append(`items[${index}][frequency]`, item.frequency)
        if (item.instructions) body.append(`items[${index}][instructions]`, item.instructions)
      })
      if (rxMode === 'handwritten' && rxPhoto) body.append('handwritten_image', rxPhoto)

      const data = await api('/medicine-prescriptions', { method: 'POST', body })
      toast.success(`${data.data.prescription_code} sent to dispenser`)
      setRxAdmissionId('')
      setRxLines([emptyRxLine()])
      setRxPhoto(null)
      setRxMode('digital')
      if (rxPhotoRef.current) rxPhotoRef.current.value = ''
      setRxTrack('pending')
      loadMyPrescriptions()
    } catch (err) {
      toast.error(err.message || 'Failed to submit prescription')
    } finally {
      setSavingRx(false)
    }
  }

  function printMyRx() {
    const roleCol = rxTrack === 'dispensed' ? 'Dispenser' : rxTrack === 'given' ? 'Nurse' : null
    const columns = ['Code', 'Patient', ...(roleCol ? [roleCol] : []), 'Items', 'Status', 'When']
    printReportTable({
      title: 'My prescriptions',
      columns,
      rows: prescriptions.map((rx) => {
        const base = [
          rx.prescription_code,
          rx.patient?.full_name || rx.patient?.patient_code || '—',
        ]
        if (rxTrack === 'dispensed') base.push(dispenserName(rx))
        if (rxTrack === 'given') base.push(nurseName(rx))
        base.push(
          rx.is_handwritten && !(rx.items || []).length ? 'Photo' : String(rx.items?.length || 0),
          statusLabel(rx.status),
          formatWhen(rx.prescribed_at),
        )
        return base
      }),
    })
  }

  function roundTypeLabel(value) {
    return ROUND_TYPES.find((t) => t.value === value)?.label || value || '—'
  }

  function printRounds() {
    printReportTable({
      title: 'Recent rounds',
      columns: ['Code', 'Patient', 'Type', 'When', 'Findings', 'Plan'],
      rows: rounds.map((r) => [
        r.round_code,
        r.patient?.full_name || r.patient?.patient_code || '—',
        roundTypeLabel(r.round_type),
        formatWhen(r.round_at),
        r.findings || '—',
        r.orders || '—',
      ]),
    })
  }

  if (activeTab === 'vitals') {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">{roleTitle}</p>
            <h2>Vitals</h2>
          </div>
        </div>
        <DoctorVitalsPanel focusNoteId={searchParams.get('note') || ''} />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{roleTitle}</p>
          <h2>{activeTab === 'rounds' ? 'Rounds' : 'Prescribe'}</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : activeTab === 'prescribe' ? (
        <>
          <form className="panel form-grid" onSubmit={handlePrescribe}>
            <div className="panel-head full">
              <h3>New prescription</h3>
            </div>

            <div className="ui-field">
              <label htmlFor="rx_admission">Patient</label>
              <ScrollSelect
                id="rx_admission"
                required
                searchable
                value={rxAdmissionId}
                placeholder="Select patient"
                options={admissionOptions}
                onChange={setRxAdmissionId}
              />
            </div>

            <div className="ui-field full">
              <label>Prescription type</label>
              <div className="rx-mode-toggle" role="group" aria-label="Prescription type">
                <button
                  type="button"
                  className={`ui-btn ui-btn-md ${rxMode === 'digital' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                  onClick={() => {
                    setRxMode('digital')
                    setRxPhoto(null)
                    if (rxPhotoRef.current) rxPhotoRef.current.value = ''
                  }}
                >
                  Digital medicines
                </button>
                <button
                  type="button"
                  className={`ui-btn ui-btn-md ${rxMode === 'handwritten' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                  onClick={() => {
                    setRxMode('handwritten')
                    setRxLines([emptyRxLine()])
                  }}
                >
                  Upload handwritten
                </button>
              </div>
            </div>

            {rxMode === 'handwritten' ? (
              <div className="ui-field full">
                <label htmlFor="rx_handwritten">Handwritten photo</label>
                <input
                  id="rx_handwritten"
                  ref={rxPhotoRef}
                  className="ui-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    if (file && !isWithinUploadLimit(file)) {
                      toast.error(uploadTooLargeMessage('Prescription image'))
                      e.target.value = ''
                      setRxPhoto(null)
                      return
                    }
                    setRxPhoto(file)
                  }}
                />
              </div>
            ) : (
              <div className="full rx-lines-scroll" ref={rxLinesScrollRef}>
                {rxLines.map((line, index) => (
                  <div className="rx-line-card" key={line.key}>
                    <div className="rx-line-card-head">
                      <strong>Medicine {index + 1}</strong>
                      <Button type="button" variant="ghost" onClick={() => removeRxLine(index)}>
                        Delete
                      </Button>
                    </div>
                    <div className="form-grid">
                      <div className="ui-field vitals-span-2" style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor={`rx_name_${index}`}>Medicine</label>
                        <MedicineTypeahead
                          id={`rx_name_${index}`}
                          medicineId={line.medicine_id}
                          selectedLabel={line.medicine_label}
                          value={line.medicine_name}
                          onPick={(med) => {
                            const label = [
                              med.name,
                              med.strength || null,
                              med.form || null,
                              med.unit ? `(${med.unit})` : null,
                            ].filter(Boolean).join(' · ')
                            setRxLine(index, {
                              medicine_id: String(med.id),
                              medicine_name: med.name,
                              medicine_label: label,
                              unit: med.unit || '',
                              form: med.form || '',
                            })
                          }}
                          onClear={() => setRxLine(index, {
                            medicine_id: '',
                            medicine_name: '',
                            medicine_label: '',
                            unit: '',
                            form: '',
                          })}
                        />
                      </div>
                      <div className="ui-field">
                        <label htmlFor={`rx_qty_${index}`}>
                          Qty{line.unit ? ` (${line.unit})` : line.form ? ` (${line.form})` : ''}
                        </label>
                        <input
                          id={`rx_qty_${index}`}
                          className="ui-input"
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => setRxLine(index, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="ui-field">
                        <label htmlFor={`rx_dose_${index}`}>Dosage</label>
                        <input
                          id={`rx_dose_${index}`}
                          className="ui-input"
                          value={line.dosage}
                          onChange={(e) => setRxLine(index, { dosage: e.target.value })}
                        />
                      </div>
                      <div className="ui-field full">
                        <label htmlFor={`rx_freq_${index}`}>When to give</label>
                        <WhenToGiveField
                          id={`rx_freq_${index}`}
                          value={line.frequency}
                          onChange={(value) => setRxLine(index, { frequency: value })}
                        />
                      </div>
                      <div className="ui-field full">
                        <label htmlFor={`rx_inst_${index}`}>Instructions</label>
                        <input
                          id={`rx_inst_${index}`}
                          className="ui-input"
                          value={line.instructions}
                          onChange={(e) => setRxLine(index, { instructions: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="form-actions full">
              {rxMode === 'digital' ? (
                <Button type="button" variant="secondary" onClick={addRxLine}>
                  Add medicine
                </Button>
              ) : null}
              <Button type="submit" disabled={savingRx || !admissions.length}>
                {savingRx ? 'Submitting…' : 'Submit to dispenser'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>My prescriptions</h3>
              <Button type="button" variant="secondary" onClick={printMyRx} disabled={!prescriptions.length}>
                Print
              </Button>
            </div>
            <div className="page-tabs" role="tablist" aria-label="Prescription track">
              {RX_TRACK_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={rxTrack === tab.value}
                  className={`page-tab${rxTrack === tab.value ? ' is-active' : ''}`}
                  onClick={() => changeRxTrack(tab.value)}
                >
                  {tab.label} ({rxTrackCounts[tab.value] ?? 0})
                </button>
              ))}
            </div>
            <div className="list-toolbar petty-list-toolbar">
              <input
                className="ui-input"
                type="search"
                value={rxSearch}
                onChange={(e) => setRxSearch(e.target.value)}
                placeholder="Search patient or code"
                aria-label="Search prescriptions"
              />
              <select
                className="ui-select"
                value={rxYear}
                onChange={(e) => {
                  setRxYear(e.target.value)
                  setRxDate('')
                }}
                aria-label="Year"
              >
                <option value="">Year</option>
                {rxYears.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              <select
                className="ui-select"
                value={rxMonth}
                onChange={(e) => {
                  setRxMonth(e.target.value)
                  setRxDate('')
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
                value={rxDate}
                onChange={(e) => {
                  setRxDate(e.target.value)
                  if (e.target.value) {
                    setRxYear('')
                    setRxMonth('')
                  }
                }}
                aria-label="Date"
              />
                  {rxTrack === 'dispensed' ? (
                <select
                  className="ui-select toolbar-filter-role"
                  value={rxDispenserFilter}
                  onChange={(e) => setRxDispenserFilter(e.target.value)}
                  aria-label="Dispenser"
                >
                  <option value="">All dispensers</option>
                  {rxDispenserOptions.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.name}</option>
                  ))}
                </select>
              ) : null}
              {rxTrack === 'given' ? (
                <select
                  className="ui-select toolbar-filter-role"
                  value={rxNurseFilter}
                  onChange={(e) => setRxNurseFilter(e.target.value)}
                  aria-label="Nurse"
                >
                  <option value="">All nurses</option>
                  {rxNurseOptions.map((n) => (
                    <option key={n.id} value={String(n.id)}>{n.name}</option>
                  ))}
                </select>
              ) : null}
            </div>
            {rxListLoading ? (
              <SkeletonCards count={2} />
            ) : prescriptions.length === 0 ? (
              <p className="panel-copy">No prescriptions for this filter.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel pharmacy-orders-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      {rxTrack === 'dispensed' ? <th>Dispenser</th> : null}
                      {rxTrack === 'given' ? <th>Nurse</th> : null}
                      <th>Items</th>
                      <th>Status</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx) => (
                      <tr
                        key={rx.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/app/medicine-slips/${rx.id}`)}
                      >
                        <td>{rx.prescription_code}</td>
                        <td>{rx.patient?.full_name || rx.patient?.patient_code || '—'}</td>
                        {rxTrack === 'dispensed' ? <td>{dispenserName(rx)}</td> : null}
                        {rxTrack === 'given' ? <td>{nurseName(rx)}</td> : null}
                        <td>{rx.is_handwritten && !(rx.items || []).length ? 'Photo' : (rx.items?.length || 0)}</td>
                        <td>
                          <span className={statusBadgeClass(rx.status)}>
                            {statusLabel(rx.status)}
                          </span>
                        </td>
                        <td>{formatWhen(rx.prescribed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleRoundSubmit}>
            <div className="panel-head full">
              <h3>Ward round</h3>
            </div>
            <div className="ui-field">
              <label>Doctor</label>
              <input className="ui-input" value={myDoctor?.full_name || user?.name || '—'} disabled />
            </div>
            <div className="ui-field">
              <label htmlFor="admission_id">Patient</label>
              <ScrollSelect
                id="admission_id"
                required
                searchable
                value={roundForm.admission_id}
                placeholder="Select patient"
                options={admissionOptions}
                onChange={(value) => setRoundField('admission_id', value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="round_type">Round type</label>
              <select id="round_type" className="ui-select" value={roundForm.round_type} onChange={(e) => setRoundField('round_type', e.target.value)}>
                {ROUND_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="next_review_at">Next review</label>
              <input id="next_review_at" type="datetime-local" className="ui-input" value={roundForm.next_review_at} onChange={(e) => setRoundField('next_review_at', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="vitals_summary">Observations summary</label>
              <input id="vitals_summary" className="ui-input" value={roundForm.vitals_summary} onChange={(e) => setRoundField('vitals_summary', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="findings">Clinical findings</label>
              <textarea id="findings" className="ui-input" rows={3} value={roundForm.findings} onChange={(e) => setRoundField('findings', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="orders">Plan &amp; orders</label>
              <textarea id="orders" className="ui-input" rows={3} value={roundForm.orders} onChange={(e) => setRoundField('orders', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingRound || !myDoctor?.id}>{savingRound ? 'Saving…' : 'Save round'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent rounds</h3>
              <Button type="button" variant="secondary" onClick={printRounds} disabled={!rounds.length}>
                Print
              </Button>
            </div>
            <div className="list-toolbar petty-list-toolbar">
              <input
                className="ui-input"
                type="search"
                value={roundSearch}
                onChange={(e) => setRoundSearch(e.target.value)}
                placeholder="Search patient or code"
                aria-label="Search rounds"
              />
              <select
                className="ui-select"
                value={roundYear}
                onChange={(e) => {
                  setRoundYear(e.target.value)
                  setRoundDate('')
                }}
                aria-label="Year"
              >
                <option value="">Year</option>
                {roundYears.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              <select
                className="ui-select"
                value={roundMonth}
                onChange={(e) => {
                  setRoundMonth(e.target.value)
                  setRoundDate('')
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
                value={roundDate}
                onChange={(e) => {
                  setRoundDate(e.target.value)
                  if (e.target.value) {
                    setRoundYear('')
                    setRoundMonth('')
                  }
                }}
                aria-label="Date"
              />
              <select
                className="ui-select toolbar-filter-role"
                value={roundTypeFilter}
                onChange={(e) => setRoundTypeFilter(e.target.value)}
                aria-label="Round type"
              >
                <option value="">All types</option>
                {ROUND_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {roundsLoading ? (
              <SkeletonCards count={2} />
            ) : rounds.length === 0 ? (
              <p className="panel-copy">No rounds for this filter.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel pharmacy-orders-scroll rounds-scroll-panel">
                <table className="data-table rounds-separated-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>When</th>
                      <th>Findings</th>
                      <th>Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((r) => (
                      <tr key={r.id}>
                        <td>{r.round_code}</td>
                        <td>{r.patient?.full_name || r.patient?.patient_code || '—'}</td>
                        <td>{roundTypeLabel(r.round_type)}</td>
                        <td>{formatWhen(r.round_at)}</td>
                        <td>{r.findings || '—'}</td>
                        <td>{r.orders || '—'}</td>
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
