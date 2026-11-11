import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
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
  guardian_name: '',
  guardian_relation: '',
  guardian_phone: '',
  guardian_cnic: '',
}

export default function RegistrationPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [duplicates, setDuplicates] = useState([])
  const [dupOpen, setDupOpen] = useState(false)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function payload(force = false) {
    return {
      first_name: form.first_name,
      last_name: form.last_name || null,
      father_name: form.father_name || null,
      cnic: form.cnic || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      age: form.age ? Number(form.age) : null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      blood_group: form.blood_group || null,
      marital_status: form.marital_status || null,
      referral_source: form.referral_source || null,
      force,
      guardian: form.guardian_name
        ? {
            name: form.guardian_name,
            relation: form.guardian_relation || null,
            phone: form.guardian_phone || null,
            cnic: form.guardian_cnic || null,
            is_emergency: true,
          }
        : undefined,
    }
  }

  async function submit(force = false) {
    setLoading(true)
    try {
      const data = await api('/patients', {
        method: 'POST',
        body: payload(force),
      })
      toast.success(`Registered ${data.data.patient_code}`)
      setDupOpen(false)
      navigate(`/app/patients/${data.data.id}`)
    } catch (err) {
      if (err.status === 409 && err.data?.duplicates) {
        setDuplicates(err.data.duplicates)
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
      </div>

      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
      >
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
          <label htmlFor="cnic">CNIC</label>
          <input
            id="cnic"
            className="ui-input"
            value={form.cnic}
            onChange={(e) => setField('cnic', e.target.value)}
          />
        </div>
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
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="date_of_birth">Date of birth</label>
          <input
            id="date_of_birth"
            type="date"
            className="ui-input"
            value={form.date_of_birth}
            onChange={(e) => setField('date_of_birth', e.target.value)}
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
          <input
            id="referral_source"
            className="ui-input"
            value={form.referral_source}
            onChange={(e) => setField('referral_source', e.target.value)}
          />
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
            value={form.guardian_phone}
            onChange={(e) => setField('guardian_phone', e.target.value)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor="guardian_cnic">Guardian CNIC</label>
          <input
            id="guardian_cnic"
            className="ui-input"
            value={form.guardian_cnic}
            onChange={(e) => setField('guardian_cnic', e.target.value)}
          />
        </div>

        <div className="form-actions full">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Register patient'}
          </Button>
        </div>
      </form>

      <Modal
        open={dupOpen}
        title="Possible duplicate"
        confirmLabel="Register anyway"
        onClose={() => setDupOpen(false)}
        onConfirm={() => submit(true)}
      >
        <p>Matching CNIC/phone already exists:</p>
        <ul className="list" style={{ marginTop: 12 }}>
          {duplicates.map((d) => (
            <li key={d.id}>
              <strong>
                {d.patient_code} · {d.full_name}
              </strong>
              <span>
                {d.phone || '—'} · {d.cnic || '—'}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
