import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const ROUND_TYPES = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'follow_up', label: 'Follow-up' },
]

const emptyDoctor = {
  full_name: '',
  specialization: '',
  license_no: '',
  phone: '',
  email: '',
}

const emptyRound = {
  doctor_id: '',
  admission_id: '',
  round_type: 'morning',
  vitals_summary: '',
  findings: '',
  orders: '',
  next_review_at: '',
}

export default function DoctorsPage() {
  const [loading, setLoading] = useState(true)
  const [savingDoctor, setSavingDoctor] = useState(false)
  const [savingRound, setSavingRound] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [rounds, setRounds] = useState([])
  const [doctorForm, setDoctorForm] = useState(emptyDoctor)
  const [roundForm, setRoundForm] = useState(emptyRound)

  function setDoctorField(key, value) {
    setDoctorForm((prev) => ({ ...prev, [key]: value }))
  }

  function setRoundField(key, value) {
    setRoundForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [docRes, admRes, rndRes] = await Promise.all([
        api('/doctors?status=active&per_page=50'),
        api('/admissions?status=active&per_page=50'),
        api('/doctor-rounds?per_page=20'),
      ])
      setDoctors(docRes.data || [])
      setAdmissions(admRes.data || [])
      setRounds(rndRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDoctorSubmit(e) {
    e.preventDefault()
    setSavingDoctor(true)
    try {
      const data = await api('/doctors', {
        method: 'POST',
        body: {
          full_name: doctorForm.full_name,
          specialization: doctorForm.specialization || null,
          license_no: doctorForm.license_no || null,
          phone: doctorForm.phone || null,
          email: doctorForm.email || null,
        },
      })
      toast.success(`${data.data.doctor_code} created`)
      setDoctorForm(emptyDoctor)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create doctor')
    } finally {
      setSavingDoctor(false)
    }
  }

  async function handleRoundSubmit(e) {
    e.preventDefault()
    setSavingRound(true)
    try {
      const data = await api('/doctor-rounds', {
        method: 'POST',
        body: {
          doctor_id: Number(roundForm.doctor_id),
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
      setRoundForm(emptyRound)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save round')
    } finally {
      setSavingRound(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Doctor Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleDoctorSubmit}>
            <div className="ui-field">
              <label htmlFor="full_name">Doctor name</label>
              <input id="full_name" className="ui-input" required value={doctorForm.full_name} onChange={(e) => setDoctorField('full_name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="specialization">Specialization</label>
              <input id="specialization" className="ui-input" value={doctorForm.specialization} onChange={(e) => setDoctorField('specialization', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="license_no">License no</label>
              <input id="license_no" className="ui-input" value={doctorForm.license_no} onChange={(e) => setDoctorField('license_no', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" className="ui-input" value={doctorForm.phone} onChange={(e) => setDoctorField('phone', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="ui-input" value={doctorForm.email} onChange={(e) => setDoctorField('email', e.target.value)} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingDoctor}>{savingDoctor ? 'Saving…' : 'Add doctor'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleRoundSubmit}>
            <div className="ui-field">
              <label htmlFor="doctor_id">Doctor</label>
              <select id="doctor_id" className="ui-select" required value={roundForm.doctor_id} onChange={(e) => setRoundField('doctor_id', e.target.value)}>
                <option value="">Select</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name} ({d.doctor_code})</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="admission_id">Active admission</label>
              <select id="admission_id" className="ui-select" required value={roundForm.admission_id} onChange={(e) => setRoundField('admission_id', e.target.value)}>
                <option value="">Select</option>
                {admissions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.admission_code} — {a.patient?.full_name || a.patient?.patient_code || 'Patient'}
                  </option>
                ))}
              </select>
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
              <label htmlFor="vitals_summary">Vitals summary</label>
              <input id="vitals_summary" className="ui-input" value={roundForm.vitals_summary} onChange={(e) => setRoundField('vitals_summary', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="findings">Findings</label>
              <textarea id="findings" className="ui-textarea" rows={3} value={roundForm.findings} onChange={(e) => setRoundField('findings', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="orders">Orders</label>
              <textarea id="orders" className="ui-textarea" rows={2} value={roundForm.orders} onChange={(e) => setRoundField('orders', e.target.value)} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingRound}>{savingRound ? 'Saving…' : 'Log round'}</Button>
            </div>
          </form>

          <div className="panel">
            <h3>Doctors</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Specialization</th>
                    <th>License</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.length === 0 ? (
                    <tr><td colSpan={5}>No doctors</td></tr>
                  ) : doctors.map((d) => (
                    <tr key={d.id}>
                      <td>{d.doctor_code}</td>
                      <td>{d.full_name}</td>
                      <td>{d.specialization || '—'}</td>
                      <td>{d.license_no || '—'}</td>
                      <td>{d.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Recent rounds</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Doctor</th>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>When</th>
                    <th>Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.length === 0 ? (
                    <tr><td colSpan={6}>No rounds</td></tr>
                  ) : rounds.map((r) => (
                    <tr key={r.id}>
                      <td>{r.round_code}</td>
                      <td>{r.doctor?.full_name || '—'}</td>
                      <td>{r.patient?.full_name || r.patient?.patient_code || '—'}</td>
                      <td>{r.round_type}</td>
                      <td>{r.round_at || '—'}</td>
                      <td>{r.findings || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
