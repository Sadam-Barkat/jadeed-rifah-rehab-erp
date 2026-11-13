import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import {
  ageFromDob,
  formatPkCnic,
  formatPkPhone,
  isValidPkCnic,
  isValidPkPhone,
} from '../../lib/pk'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import ImageCaptureField from '../../components/ui/ImageCaptureField'
import Modal from '../../components/ui/Modal'
import '../pages.css'

const emptyForm = {
  first_name: '',
  last_name: '',
  father_name: '',
  cnic: '',
  gender: '',
  date_of_birth: '',
  age: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  blood_group: '',
  marital_status: '',
  referral_source: '',
  plan_days: '30',
  action_mode: 'admit',
  bed_id: '',
  guardian_name: '',
  guardian_relation: '',
  guardian_phone: '',
  guardian_cnic: '',
}

export default function RegistrationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role_slug === 'admin'
  const [form, setForm] = useState(emptyForm)
  const [cnicFront, setCnicFront] = useState(null)
  const [cnicBack, setCnicBack] = useState(null)
  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(false)
  const [duplicates, setDuplicates] = useState([])
  const [dupMatched, setDupMatched] = useState([])
  const [dupMessage, setDupMessage] = useState('')
  const [dupOpen, setDupOpen] = useState(false)

  const backTo =
    location.state?.backTo ||
    (isAdmin ? '/app/management?tab=patients' : '/app/patients')
  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onDobChange(value) {
    setForm((prev) => ({
      ...prev,
      date_of_birth: value,
      age: ageFromDob(value),
    }))
  }

  useEffect(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    api('/beds/available')
      .then((res) => {
        if (!cancelled) setBeds(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setBeds([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  function buildFormData(force = false) {
    const fd = new FormData()
    fd.append('first_name', form.first_name)
    if (form.last_name) fd.append('last_name', form.last_name)
    if (form.father_name) fd.append('father_name', form.father_name)
    if (form.cnic) fd.append('cnic', form.cnic)
    if (form.gender) fd.append('gender', form.gender)
    if (form.date_of_birth) fd.append('date_of_birth', form.date_of_birth)
    if (form.age) fd.append('age', String(Number(form.age)))
    if (form.phone) fd.append('phone', form.phone)
    if (form.email) fd.append('email', form.email)
    if (form.address) fd.append('address', form.address)
    if (form.city) fd.append('city', form.city)
    if (form.blood_group) fd.append('blood_group', form.blood_group)
    if (form.marital_status) fd.append('marital_status', form.marital_status)
    if (form.referral_source) fd.append('referral_source', form.referral_source)
    fd.append('plan_days', form.plan_days)
    fd.append('action_mode', isAdmin ? 'admit' : 'register')
    if (isAdmin && form.bed_id) {
      fd.append('bed_id', String(form.bed_id))
    }
    if (force) fd.append('force', '1')
    if (cnicFront) fd.append('cnic_front', cnicFront)
    if (cnicBack) fd.append('cnic_back', cnicBack)
    if (form.guardian_name) {
      fd.append('guardian[name]', form.guardian_name)
      if (form.guardian_relation) fd.append('guardian[relation]', form.guardian_relation)
      if (form.guardian_phone) fd.append('guardian[phone]', form.guardian_phone)
      if (form.guardian_cnic) fd.append('guardian[cnic]', form.guardian_cnic)
      fd.append('guardian[is_emergency]', '1')
    }
    return fd
  }

  async function submit() {
    if (!isValidPkCnic(form.cnic)) {
      toast.error('Enter a valid CNIC (XXXXX-XXXXXXX-X)')
      return
    }
    if (!isValidPkPhone(form.phone)) {
      toast.error('Enter a valid phone (11 digits, e.g. 03XXXXXXXXX)')
      return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Enter a valid email')
      return
    }
    if (form.guardian_cnic && !isValidPkCnic(form.guardian_cnic)) {
      toast.error('Enter a valid guardian CNIC')
      return
    }
    if (form.guardian_phone && !isValidPkPhone(form.guardian_phone)) {
      toast.error('Enter a valid guardian phone (11 digits)')
      return
    }
    if (!cnicFront || !cnicBack) {
      toast.error('CNIC front and back images are required')
      return
    }
    if (isAdmin && !form.bed_id) {
      toast.error('Select a bed to admit')
      return
    }
    setLoading(true)
    try {
      const data = await api('/patients', {
        method: 'POST',
        body: buildFormData(false),
      })
      toast.success(data.message || `Saved ${data.data.patient_code}`)
      setDupOpen(false)
      navigate(`/app/patients/${data.data.id}`, { state: { backTo } })
    } catch (err) {
      if (err.status === 409 && err.data?.duplicates) {
        setDuplicates(err.data.duplicates)
        setDupMatched(err.data.matched_fields || [])
        setDupMessage(err.data.message || 'Duplicate found. Patient already exists.')
        setDupOpen(true)
      } else {
        toast.error(err.message || 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Patient Registration</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>
            Back
          </Link>
        </div>
      </div>

      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="ui-field">
          <label htmlFor="plan_days">Plan</label>
          <select
            id="plan_days"
            className="ui-select"
            required
            value={form.plan_days}
            onChange={(e) => setField('plan_days', e.target.value)}
          >
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>

        {isAdmin ? (
          <div className="ui-field">
            <label htmlFor="bed_id">Bed</label>
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
                  {b.bed_code} · {b.room_name || b.room_code}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="ui-field">
          <label htmlFor="first_name">First name</label>
          <input
            id="first_name"
            className="ui-input"
            required
            value={form.first_name}
            onChange={(e) => setField('first_name', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="last_name">Last name</label>
          <input
            id="last_name"
            className="ui-input"
            value={form.last_name}
            onChange={(e) => setField('last_name', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="father_name">Father name</label>
          <input
            id="father_name"
            className="ui-input"
            value={form.father_name}
            onChange={(e) => setField('father_name', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="cnic">CNIC number</label>
          <input
            id="cnic"
            className="ui-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="XXXXX-XXXXXXX-X"
            maxLength={15}
            required
            value={form.cnic}
            onChange={(e) => setField('cnic', formatPkCnic(e.target.value))}
          />
        </div>
        <ImageCaptureField
          id="cnic_front"
          label="CNIC front"
          value={cnicFront}
          required
          filenamePrefix="cnic-front"
          onChange={setCnicFront}
        />
        <ImageCaptureField
          id="cnic_back"
          label="CNIC back"
          value={cnicBack}
          required
          filenamePrefix="cnic-back"
          onChange={setCnicBack}
        />
        <div className="ui-field">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            className="ui-select"
            value={form.gender}
            onChange={(e) => setField('gender', e.target.value)}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="ui-field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            className="ui-input"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="03XXXXXXXXX"
            maxLength={11}
            required
            value={form.phone}
            onChange={(e) => setField('phone', formatPkPhone(e.target.value))}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="date_of_birth">Date of birth</label>
          <input
            id="date_of_birth"
            type="date"
            className="ui-input"
            max={new Date().toISOString().slice(0, 10)}
            value={form.date_of_birth}
            onChange={(e) => onDobChange(e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            min="0"
            className="ui-input"
            value={form.age}
            readOnly={!!form.date_of_birth}
            onChange={(e) => setField('age', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="city">City</label>
          <input
            id="city"
            className="ui-input"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="referral_source">Referral source</label>
          <select
            id="referral_source"
            className="ui-select"
            value={form.referral_source}
            onChange={(e) => setField('referral_source', e.target.value)}
          >
            <option value="">Select</option>
            <option value="Self">Self</option>
            <option value="Family / Friend">Family / Friend</option>
            <option value="Doctor">Doctor</option>
            <option value="Hospital">Hospital</option>
            <option value="Clinic">Clinic</option>
            <option value="Social media">Social media</option>
            <option value="Website">Website</option>
            <option value="Advertisement">Advertisement</option>
            <option value="Previous patient">Previous patient</option>
            <option value="NGO / Welfare">NGO / Welfare</option>
            <option value="Police / Court">Police / Court</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="ui-field full">
          <label htmlFor="address">Address</label>
          <input
            id="address"
            className="ui-input"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
          />
        </div>

        <h3 className="form-section full">Guardian / emergency contact</h3>
        <div className="ui-field">
          <label htmlFor="guardian_name">Guardian name</label>
          <input
            id="guardian_name"
            className="ui-input"
            value={form.guardian_name}
            onChange={(e) => setField('guardian_name', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="guardian_relation">Relation</label>
          <input
            id="guardian_relation"
            className="ui-input"
            value={form.guardian_relation}
            onChange={(e) => setField('guardian_relation', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="guardian_phone">Guardian phone</label>
          <input
            id="guardian_phone"
            className="ui-input"
            inputMode="numeric"
            placeholder="03XXXXXXXXX"
            maxLength={11}
            value={form.guardian_phone}
            onChange={(e) => setField('guardian_phone', formatPkPhone(e.target.value))}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="guardian_cnic">Guardian CNIC</label>
          <input
            id="guardian_cnic"
            className="ui-input"
            inputMode="numeric"
            placeholder="XXXXX-XXXXXXX-X"
            maxLength={15}
            value={form.guardian_cnic}
            onChange={(e) => setField('guardian_cnic', formatPkCnic(e.target.value))}
          />
        </div>

        <div className="form-actions full">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isAdmin ? 'Register & admit' : 'Submit registration'}
          </Button>
        </div>
      </form>

      <Modal open={dupOpen} title="Duplicate found" onClose={() => setDupOpen(false)} size="sm">
        <div className="dup-alert">
          <p className="dup-alert-msg">
            {dupMatched.length
              ? `Duplicate ${dupMatched.join(' & ')} — patient already exists.`
              : dupMessage || 'Patient already exists.'}
          </p>
          {duplicates.map((d) => {
            const matched = Array.isArray(d.matched) && d.matched.length ? d.matched : dupMatched
            const bits = []
            if (matched.includes('CNIC')) bits.push(`CNIC ${d.cnic || '—'}`)
            if (matched.includes('Phone')) bits.push(`Phone ${d.phone || '—'}`)
            if (matched.includes('Email')) bits.push(`Email ${d.email || '—'}`)
            return (
              <p key={d.id} className="dup-alert-row">
                <strong>
                  {d.patient_code} · {d.full_name}
                </strong>
                {bits.length ? <span>{bits.join(' · ')}</span> : null}
              </p>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
