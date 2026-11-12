import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  admission_id: '',
  visitor_name: '',
  party_size: '1',
  relation: 'relative',
  phone: '',
  cnic: '',
}

export default function VisitorsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [visits, setVisits] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [patientSearch, setPatientSearch] = useState('')

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes, visRes] = await Promise.all([
        api('/admissions?status=active&per_page=50'),
        api(`/visitor-logs?per_page=50${search ? `&search=${encodeURIComponent(search)}` : ''}`),
      ])
      setAdmissions(admRes.data || [])
      setVisits(visRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load visitors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredAdmissions = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    if (!q) return admissions
    return admissions.filter((a) => {
      const name = (a.patient?.full_name || '').toLowerCase()
      const code = (a.admission_code || '').toLowerCase()
      const pcode = (a.patient?.patient_code || '').toLowerCase()
      return name.includes(q) || code.includes(q) || pcode.includes(q)
    })
  }, [admissions, patientSearch])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api('/visitor-logs', {
        method: 'POST',
        body: {
          admission_id: Number(form.admission_id),
          visitor_name: form.visitor_name,
          party_size: Number(form.party_size) || 1,
          relation: form.relation || null,
          phone: form.phone,
          cnic: form.cnic || null,
        },
      })
      toast.success(`Visitor ${data.data.visit_code} logged`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Check-in failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gate</p>
          <h2>Gate Visitors</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field full">
              <label htmlFor="patient_search">Find patient</label>
              <input
                id="patient_search"
                className="ui-input"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search name or code"
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="admission_id">Patient</label>
              <select
                id="admission_id"
                className="ui-select"
                required
                value={form.admission_id}
                onChange={(e) => setField('admission_id', e.target.value)}
              >
                <option value="">Select</option>
                {filteredAdmissions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.patient?.full_name || a.patient?.patient_code} — {a.admission_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="party_size">Party size</label>
              <select
                id="party_size"
                className="ui-select"
                value={form.party_size}
                onChange={(e) => setField('party_size', e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n === 1 ? 'Single (1)' : n}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="relation">Relation</label>
              <select
                id="relation"
                className="ui-select"
                value={form.relation}
                onChange={(e) => setField('relation', e.target.value)}
              >
                <option value="relative">Relative</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
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
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                className="ui-input"
                required
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
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
            <div className="ui-field full actions">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log visitor'}</Button>
            </div>
          </form>

          <div className="panel">
            <div className="list-toolbar">
              <input
                className="ui-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search visitors"
              />
              <Button type="button" variant="secondary" onClick={load}>Search</Button>
            </div>
            <div className="scroll-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Patient</th>
                    <th>Visitor</th>
                    <th>Party</th>
                    <th>Phone</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.length === 0 ? (
                    <tr><td colSpan={6}>No visitors</td></tr>
                  ) : visits.map((v) => (
                    <tr key={v.id}>
                      <td>{v.visit_code}</td>
                      <td>{v.patient?.full_name || '—'}</td>
                      <td>{v.visitor_name}</td>
                      <td>{v.party_size || 1}</td>
                      <td>{v.phone || '—'}</td>
                      <td>{v.logged_by || '—'}</td>
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
