import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { isWithinUploadLimit, uploadTooLargeMessage } from '../../lib/uploadLimits'
import Button from '../../components/ui/Button'
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

const emptyRxLine = {
  medicine_name: '',
  medicine_id: '',
  quantity: '1',
  dosage: '',
  frequency: '',
  instructions: '',
  stock_qty: null,
  unit: '',
  low_stock: false,
}

export default function DoctorsPage() {
  const [loading, setLoading] = useState(true)
  const [savingDoctor, setSavingDoctor] = useState(false)
  const [savingRound, setSavingRound] = useState(false)
  const [savingRx, setSavingRx] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [rounds, setRounds] = useState([])
  const [medicines, setMedicines] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [doctorForm, setDoctorForm] = useState(emptyDoctor)
  const [roundForm, setRoundForm] = useState(emptyRound)
  const [nurses, setNurses] = useState([])
  const [rxAdmissionId, setRxAdmissionId] = useState('')
  const [rxNurseId, setRxNurseId] = useState('')
  const [rxNotes, setRxNotes] = useState('')
  const [rxLines, setRxLines] = useState([{ ...emptyRxLine }])
  const [rxPhoto, setRxPhoto] = useState(null)
  const rxPhotoRef = useRef(null)

  function setDoctorField(key, value) {
    setDoctorForm((prev) => ({ ...prev, [key]: value }))
  }

  function setRoundField(key, value) {
    setRoundForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [docRes, admRes, rndRes, medRes, rxRes, nurseRes] = await Promise.all([
        api('/doctors?status=active&per_page=50'),
        api('/admissions?status=active&per_page=50'),
        api('/doctor-rounds?per_page=20'),
        api('/medicines?status=active&per_page=100'),
        api('/medicine-prescriptions?per_page=20'),
        api('/staff/nurses'),
      ])
      setDoctors(docRes.data || [])
      setAdmissions(admRes.data || [])
      setRounds(rndRes.data || [])
      setMedicines(medRes.data || [])
      setPrescriptions(rxRes.data || [])
      setNurses(nurseRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }

  function setRxLine(index, key, value) {
    setRxLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)))
  }

  function addRxLine() {
    setRxLines((prev) => [...prev, { ...emptyRxLine }])
  }

  function removeRxLine(index) {
    setRxLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
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

  async function handlePrescribe(e) {
    e.preventDefault()

    const items = rxLines
      .filter((line) => (line.medicine_name.trim() || line.medicine_id) && Number(line.quantity) > 0)
      .map((line) => {
        const matched = line.medicine_id
          ? medicines.find((m) => String(m.id) === String(line.medicine_id))
          : null
        return {
          medicine_id: line.medicine_id ? Number(line.medicine_id) : null,
          medicine_name: line.medicine_name.trim() || matched?.name || '',
          quantity: Number(line.quantity),
          dosage: line.dosage || null,
          frequency: line.frequency || null,
          instructions: line.instructions || null,
        }
      })

    if (!items.length && !rxPhoto) {
      toast.error('Add medicines or upload a handwritten prescription photo')
      return
    }

    if (!rxAdmissionId) {
      toast.error('Select a patient')
      return
    }
    if (!rxNurseId) {
      toast.error('Select a nurse')
      return
    }

    if (rxPhoto && !isWithinUploadLimit(rxPhoto)) {
      toast.error(uploadTooLargeMessage('Prescription image'))
      return
    }

    setSavingRx(true)
    try {
      const body = new FormData()
      body.append('admission_id', String(Number(rxAdmissionId)))
      body.append('nurse_id', String(Number(rxNurseId)))
      if (rxNotes) body.append('notes', rxNotes)
      items.forEach((item, index) => {
        if (item.medicine_id) body.append(`items[${index}][medicine_id]`, String(item.medicine_id))
        body.append(`items[${index}][medicine_name]`, item.medicine_name)
        body.append(`items[${index}][quantity]`, String(item.quantity))
        if (item.dosage) body.append(`items[${index}][dosage]`, item.dosage)
        if (item.frequency) body.append(`items[${index}][frequency]`, item.frequency)
        if (item.instructions) body.append(`items[${index}][instructions]`, item.instructions)
      })
      if (rxPhoto) body.append('handwritten_image', rxPhoto)

      const data = await api('/medicine-prescriptions', { method: 'POST', body })
      toast.success(`${data.data.prescription_code} sent to dispenser`)
      setRxAdmissionId('')
      setRxNurseId('')
      setRxNotes('')
      setRxLines([{ ...emptyRxLine }])
      setRxPhoto(null)
      if (rxPhotoRef.current) rxPhotoRef.current.value = ''
      const rxRes = await api('/medicine-prescriptions?per_page=20')
      setPrescriptions(rxRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to submit prescription')
    } finally {
      setSavingRx(false)
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

          <form className="panel form-grid" onSubmit={handlePrescribe}>
            <div className="panel-head full">
              <h3>Prescribe medicines</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="rx_admission">Patient</label>
              <ScrollSelect
                id="rx_admission"
                required
                value={rxAdmissionId}
                placeholder="Select admission"
                options={admissions.map((a) => ({
                  value: a.id,
                  label: `${a.admission_code} — ${a.patient?.full_name || a.patient?.patient_code || 'Patient'}`,
                }))}
                onChange={setRxAdmissionId}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="rx_nurse">Nurse</label>
              <ScrollSelect
                id="rx_nurse"
                required
                value={rxNurseId}
                placeholder="Select nurse"
                options={nurses.map((n) => ({
                  value: n.id,
                  label: `${n.name}${n.staff_code ? ` · ${n.staff_code}` : ''}`,
                }))}
                onChange={setRxNurseId}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="rx_notes">Notes</label>
              <input id="rx_notes" className="ui-input" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} />
            </div>
            <div className="full rx-lines-scroll">
              {rxLines.map((line, index) => (
                <div
                  className={`rx-line-card${line.medicine_id && Number(line.stock_qty) <= 0 ? ' is-stock-danger' : ''}${line.medicine_id && line.low_stock && Number(line.stock_qty) > 0 ? ' is-stock-warn' : ''}${line.medicine_id && Number(line.quantity) > Number(line.stock_qty) && Number(line.stock_qty) > 0 ? ' is-stock-danger' : ''}`}
                  key={`rx-line-${index}`}
                >
                  <div className="rx-line-card-head">
                    <strong>Medicine {index + 1}</strong>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeRxLine(index)}
                      disabled={rxLines.length <= 1 && !rxPhoto}
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="form-grid">
                    <div className="ui-field">
                      <label htmlFor={`rx_name_${index}`}>Medicine</label>
                      <input
                        id={`rx_name_${index}`}
                        className="ui-input"
                        value={line.medicine_name}
                        onChange={(e) => setRxLine(index, 'medicine_name', e.target.value)}
                        placeholder="Type medicine name"
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor={`rx_med_${index}`}>Match stock (optional)</label>
                      <ScrollSelect
                        id={`rx_med_${index}`}
                        searchable
                        value={line.medicine_id}
                        placeholder="Optional"
                        options={medicines.map((m) => ({
                          value: m.id,
                          label: `${m.name}${m.strength ? ` · ${m.strength}` : ''} · stock ${m.stock_qty}`,
                        }))}
                        onChange={(value) => {
                          const med = medicines.find((m) => String(m.id) === String(value))
                          const stock = Number(med?.stock_qty || 0)
                          if (med && stock <= 0) {
                            toast.error(`${med.name} is out of stock. Available: 0`)
                          } else if (med?.low_stock) {
                            toast.message(`${med.name} · Available: ${stock} ${med.unit || ''}`.trim())
                          }
                          setRxLines((prev) => prev.map((row, i) => (
                            i === index
                              ? {
                                  ...row,
                                  medicine_id: value,
                                  medicine_name: row.medicine_name.trim() || med?.name || '',
                                  stock_qty: med ? stock : null,
                                  unit: med?.unit || '',
                                  low_stock: !!med?.low_stock,
                                  quantity: med && stock > 0
                                    ? String(Math.min(Number(row.quantity || 1), stock) || 1)
                                    : row.quantity,
                                }
                              : row
                          )))
                        }}
                      />
                      {line.medicine_id && line.stock_qty != null ? (
                        <p className={`stock-avail-note${Number(line.stock_qty) <= 0 || Number(line.quantity) > Number(line.stock_qty) ? ' is-danger' : ''}${line.low_stock && Number(line.stock_qty) > 0 ? ' is-warn' : ''}`}>
                          {Number(line.stock_qty) <= 0
                            ? 'Out of stock · available 0'
                            : `Available: ${line.stock_qty} ${line.unit || ''}`.trim()}
                        </p>
                      ) : null}
                    </div>
                    <div className="ui-field">
                      <label htmlFor={`rx_qty_${index}`}>Qty</label>
                      <input
                        id={`rx_qty_${index}`}
                        className="ui-input"
                        type="number"
                        min="1"
                        max={line.stock_qty != null && Number(line.stock_qty) > 0 ? Number(line.stock_qty) : undefined}
                        value={line.quantity}
                        onChange={(e) => {
                          setRxLine(index, 'quantity', e.target.value)
                          if (line.stock_qty != null && Number(e.target.value) > Number(line.stock_qty)) {
                            toast.error(`Available: ${line.stock_qty} ${line.unit || ''}`.trim())
                          }
                        }}
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor={`rx_dose_${index}`}>Dosage</label>
                      <input
                        id={`rx_dose_${index}`}
                        className="ui-input"
                        value={line.dosage}
                        onChange={(e) => setRxLine(index, 'dosage', e.target.value)}
                      />
                    </div>
                    <div className="ui-field full">
                      <label htmlFor={`rx_freq_${index}`}>When to give</label>
                      <WhenToGiveField
                        id={`rx_freq_${index}`}
                        value={line.frequency}
                        onChange={(value) => setRxLine(index, 'frequency', value)}
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor={`rx_inst_${index}`}>Instructions</label>
                      <input
                        id={`rx_inst_${index}`}
                        className="ui-input"
                        value={line.instructions}
                        onChange={(e) => setRxLine(index, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ui-field full">
              <label htmlFor="rx_handwritten">Handwritten prescription photo</label>
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
            <div className="form-actions full">
              <Button type="button" variant="secondary" onClick={addRxLine}>
                Add medicine
              </Button>
              <Button type="submit" disabled={savingRx || !admissions.length || !nurses.length}>
                {savingRx ? 'Submitting…' : 'Submit to dispenser'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>My prescriptions</h3>
            </div>
            {prescriptions.length === 0 ? (
              <p className="panel-copy">No prescriptions yet.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx) => (
                      <tr key={rx.id}>
                        <td>{rx.prescription_code}</td>
                        <td>{rx.patient?.full_name || rx.patient?.patient_code || '—'}</td>
                        <td>{rx.is_handwritten && !(rx.items || []).length ? 'Photo' : (rx.items?.length || 0)}</td>
                        <td>
                          <span className={`badge ${rx.status === 'pending' ? 'badge-warn' : rx.status === 'dispensed' ? 'badge-ok' : ''}`}>
                            {rx.status === 'pending' ? 'Pending' : rx.status === 'dispensed' ? 'Dispensed' : rx.status}
                          </span>
                        </td>
                        <td>{rx.prescribed_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
