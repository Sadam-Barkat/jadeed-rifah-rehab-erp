import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const RECORD_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'progress', label: 'Progress' },
  { value: 'prescription_note', label: 'Prescription note' },
  { value: 'other', label: 'Other' },
]

const emptyForm = {
  admission_id: '',
  record_type: 'consultation',
  chief_complaint: '',
  diagnosis: '',
  clinical_findings: '',
  treatment_advice: '',
  medications_prescribed: '',
}

export default function MedicalRecordsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [records, setRecords] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, recRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api('/medical-records?per_page=20'),
      ])
      setAdmissions(admRes.data || [])
      setRecords(recRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load medical records')
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
      const data = await api('/medical-records', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          record_type: form.record_type,
          chief_complaint: form.chief_complaint || null,
          diagnosis: form.diagnosis || null,
          clinical_findings: form.clinical_findings || null,
          treatment_advice: form.treatment_advice || null,
          medications_prescribed: form.medications_prescribed || null,
        },
      })
      toast.success(`Record ${data.data.record_code} saved`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Medical Records</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field full">
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
              <label htmlFor="record_type">Record type</label>
              <select
                id="record_type"
                className="ui-select"
                value={form.record_type}
                onChange={(e) => setField('record_type', e.target.value)}
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="chief_complaint">Chief complaint</label>
              <input
                id="chief_complaint"
                className="ui-input"
                value={form.chief_complaint}
                onChange={(e) => setField('chief_complaint', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="diagnosis">Diagnosis</label>
              <input
                id="diagnosis"
                className="ui-input"
                value={form.diagnosis}
                onChange={(e) => setField('diagnosis', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="clinical_findings">Clinical findings</label>
              <input
                id="clinical_findings"
                className="ui-input"
                value={form.clinical_findings}
                onChange={(e) => setField('clinical_findings', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="treatment_advice">Treatment advice</label>
              <input
                id="treatment_advice"
                className="ui-input"
                value={form.treatment_advice}
                onChange={(e) => setField('treatment_advice', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="medications_prescribed">Medications prescribed</label>
              <input
                id="medications_prescribed"
                className="ui-input"
                value={form.medications_prescribed}
                onChange={(e) => setField('medications_prescribed', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !admissions.length}>
                {saving ? 'Saving...' : 'Save medical record'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent records</h3>
            </div>
            {records.length === 0 ? (
              <p className="panel-copy">No medical records yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Diagnosis</th>
                      <th>When</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td>{r.record_code}</td>
                        <td>
                          {r.patient?.patient_code} · {r.patient?.full_name}
                        </td>
                        <td>
                          <span className="badge">{r.record_type}</span>
                        </td>
                        <td>{r.diagnosis || '—'}</td>
                        <td>{r.recorded_at}</td>
                        <td>{r.created_by_name || '—'}</td>
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
