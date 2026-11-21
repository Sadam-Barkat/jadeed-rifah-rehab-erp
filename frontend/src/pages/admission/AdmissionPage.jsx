import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  patient_id: '',
  bed_id: '',
  program_days: '30',
  package_name: '',
  belongings_notes: '',
  consent_notes: '',
}

const ADMITTED_PATH = '/app/management?tab=patients&status=admitted'

export default function AdmissionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const focusPatientId =
    searchParams.get('patient_id') ||
    (location.state?.patientId ? String(location.state.patientId) : '')
  const focused = Boolean(focusPatientId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [patients, setPatients] = useState([])
  const [beds, setBeds] = useState([])
  const [focusPatient, setFocusPatient] = useState(null)
  const [form, setForm] = useState({
    ...emptyForm,
    patient_id: focusPatientId,
    program_days: location.state?.planDays ? String(location.state.planDays) : '30',
  })

  const backTo = location.state?.backTo || '/app/management?tab=patients&status=registered'

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedPatient = useMemo(() => {
    if (focusPatient && String(focusPatient.id) === String(form.patient_id)) return focusPatient
    return patients.find((p) => String(p.id) === String(form.patient_id)) || null
  }, [patients, focusPatient, form.patient_id])

  async function load() {
    setLoading(true)
    try {
      const [patientRes, bedRes] = await Promise.all([
        api('/patients?status=registered&per_page=50'),
        api('/beds/available'),
      ])
      const list = patientRes.data || []
      setPatients(list)
      setBeds(bedRes.data || [])

      if (focusPatientId) {
        let row = list.find((p) => String(p.id) === String(focusPatientId))
        if (!row) {
          try {
            const detail = await api(`/patients/${focusPatientId}`)
            row = detail.data
          } catch {
            row = null
          }
        }
        setFocusPatient(row || null)
        if (row) {
          setForm((prev) => ({
            ...prev,
            patient_id: String(row.id),
            program_days: String(row.plan_days || prev.program_days || 30),
            package_name: row.plan_days ? `${row.plan_days}-Day Program` : prev.package_name,
          }))
          if (row.status && row.status !== 'registered') {
            toast.message('Patient already processed')
            navigate(ADMITTED_PATH, { replace: true })
          }
        } else {
          toast.error('Patient not found for admission')
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load admission data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [focusPatientId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.patient_id) {
      toast.error('Select a patient')
      return
    }
    if (!form.bed_id) {
      toast.error('Select an available bed')
      return
    }
    if (!beds.length) {
      toast.error('No available beds')
      return
    }
    setSaving(true)
    try {
      const days = Number(form.program_days)
      const data = await api('/admissions', {
        method: 'POST',
        body: {
          patient_id: Number(form.patient_id),
          bed_id: Number(form.bed_id),
          program_days: days,
          package_name: form.package_name || `${days}-Day Program`,
          belongings_notes: form.belongings_notes || null,
          consent_notes: form.consent_notes || null,
          activate: true,
        },
      })
      toast.success(`Admission ${data.data.admission_code} created`)
      navigate(ADMITTED_PATH, { replace: true })
    } catch (err) {
      toast.error(err.message || 'Admission failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Patient Admission</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>
            Back
          </Link>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          {selectedPatient ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Patient</h3>
                <span className="badge">{String(selectedPatient.status || 'registered').replaceAll('_', ' ')}</span>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Code</span>
                  <strong>{selectedPatient.patient_code || '—'}</strong>
                </div>
                <div>
                  <span>Name</span>
                  <strong>{selectedPatient.full_name || '—'}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{selectedPatient.phone || '—'}</strong>
                </div>
                <div>
                  <span>Plan</span>
                  <strong>{selectedPatient.plan_days ? `${selectedPatient.plan_days} days` : '—'}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <form className="panel form-grid" onSubmit={handleSubmit}>
            {!focused ? (
              <div className="ui-field">
                <label htmlFor="patient_id">Registered patient</label>
                <select
                  id="patient_id"
                  className="ui-select"
                  required
                  value={form.patient_id}
                  onChange={(e) => {
                    const id = e.target.value
                    setField('patient_id', id)
                    const row = patients.find((p) => String(p.id) === String(id))
                    if (row?.plan_days) {
                      setForm((prev) => ({
                        ...prev,
                        patient_id: id,
                        program_days: String(row.plan_days),
                        package_name: `${row.plan_days}-Day Program`,
                      }))
                    }
                  }}
                >
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} · {p.full_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="patient_id" value={form.patient_id} />
            )}

            <div className="ui-field">
              <label htmlFor="bed_id">Available bed</label>
              <select
                id="bed_id"
                className="ui-select"
                required
                value={form.bed_id}
                onChange={(e) => setField('bed_id', e.target.value)}
                disabled={!beds.length}
              >
                <option value="">{beds.length ? 'Select bed' : 'No beds available'}</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bed_code} · {b.room_name} (Floor {b.floor || '—'})
                  </option>
                ))}
              </select>
              {!beds.length ? (
                <p className="panel-copy" style={{ marginTop: 6 }}>
                  Free a bed first, then admit this patient.
                </p>
              ) : null}
            </div>

            <div className="ui-field">
              <label htmlFor="program_days">Program</label>
              <select
                id="program_days"
                className="ui-select"
                value={form.program_days}
                onChange={(e) => {
                  const days = e.target.value
                  setForm((prev) => ({
                    ...prev,
                    program_days: days,
                    package_name: `${days}-Day Program`,
                  }))
                }}
              >
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>

            <div className="ui-field full">
              <label htmlFor="belongings_notes">Belongings</label>
              <input
                id="belongings_notes"
                className="ui-input"
                value={form.belongings_notes}
                onChange={(e) => setField('belongings_notes', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="consent_notes">Consent notes</label>
              <input
                id="consent_notes"
                className="ui-input"
                value={form.consent_notes}
                onChange={(e) => setField('consent_notes', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button
                type="submit"
                disabled={saving || !form.patient_id || !beds.length}
              >
                {saving ? 'Saving...' : 'Admit patient'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
