import { useEffect, useState } from 'react'
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
  clinical_notes: '',
}

export default function AdmissionPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [patients, setPatients] = useState([])
  const [beds, setBeds] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [patientRes, bedRes, admissionRes] = await Promise.all([
        api('/patients?status=registered&per_page=50'),
        api('/beds/available'),
        api('/admissions?per_page=20'),
      ])
      setPatients(patientRes.data || [])
      setBeds(bedRes.data || [])
      setAdmissions(admissionRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load admission data')
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
      const data = await api('/admissions', {
        method: 'POST',
        body: {
          patient_id: Number(form.patient_id),
          bed_id: Number(form.bed_id),
          program_days: Number(form.program_days),
          package_name: form.package_name || null,
          belongings_notes: form.belongings_notes || null,
          consent_notes: form.consent_notes || null,
          clinical_notes: form.clinical_notes || null,
          activate: true,
        },
      })
      toast.success(`Admission ${data.data.admission_code} created`)
      setForm(emptyForm)
      load()
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
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="patient_id">Registered patient</label>
              <select
                id="patient_id"
                className="ui-select"
                required
                value={form.patient_id}
                onChange={(e) => setField('patient_id', e.target.value)}
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient_code} · {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="bed_id">Available bed</label>
              <select
                id="bed_id"
                className="ui-select"
                required
                value={form.bed_id}
                onChange={(e) => setField('bed_id', e.target.value)}
              >
                <option value="">Select bed</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bed_code} · {b.room_name} (Floor {b.floor || '—'})
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="program_days">Program</label>
              <select
                id="program_days"
                className="ui-select"
                value={form.program_days}
                onChange={(e) => setField('program_days', e.target.value)}
              >
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="package_name">Package name</label>
              <input
                id="package_name"
                className="ui-input"
                value={form.package_name}
                onChange={(e) => setField('package_name', e.target.value)}
              />
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
              <Button type="submit" disabled={saving || !patients.length || !beds.length}>
                {saving ? 'Saving...' : 'Admit patient'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent admissions</h3>
            </div>
            {admissions.length === 0 ? (
              <p className="panel-copy">No admissions yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Bed</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>Admitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admissions.map((a) => (
                      <tr key={a.id}>
                        <td>{a.admission_code}</td>
                        <td>
                          {a.patient?.patient_code} · {a.patient?.full_name}
                        </td>
                        <td>
                          {a.bed?.bed_code} · {a.bed?.room_name}
                        </td>
                        <td>{a.program_days} days</td>
                        <td>
                          <span className="badge">{a.status}</span>
                        </td>
                        <td>{a.admitted_at}</td>
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
