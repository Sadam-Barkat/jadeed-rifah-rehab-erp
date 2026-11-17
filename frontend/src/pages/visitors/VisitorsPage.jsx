import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  known_key: '',
  admission_id: '',
  visitor_name: '',
  party_size: '1',
  cnic: '',
  phone: '',
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

export default function VisitorsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAtt, setSavingAtt] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [admissions, setAdmissions] = useState([])
  const [directory, setDirectory] = useState([])
  const [visits, setVisits] = useState([])
  const [present, setPresent] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [attCode, setAttCode] = useState('')
  const [attPhoto, setAttPhoto] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [checkoutTarget, setCheckoutTarget] = useState(null)

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

  async function loadVisits(q = debouncedSearch) {
    const params = new URLSearchParams({ per_page: '50' })
    if (q) params.set('search', q)
    const visRes = await api(`/visitor-logs?${params}`)
    setVisits(visRes.data || [])
  }

  async function load() {
    setLoading(true)
    try {
      const [admRes] = await Promise.all([
        api('/admissions?status=active&per_page=100'),
        loadVisits(debouncedSearch),
        loadPresent(),
        loadDirectory(),
      ])
      setAdmissions(admRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load visitors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (loading) return
    loadVisits(debouncedSearch).catch((err) => toast.error(err.message || 'Search failed'))
  }, [debouncedSearch])

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
      setForm((prev) => ({
        ...prev,
        known_key: '',
      }))
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
      const photoInput = document.getElementById('staff_att_photo')
      if (photoInput) photoInput.value = ''
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
    setSaving(true)
    try {
      const body = {
        visitor_name: form.visitor_name.trim(),
        party_size: Number(form.party_size) || 1,
        cnic: form.cnic.trim(),
        phone: form.phone.trim() || null,
      }
      if (form.admission_id) body.admission_id = Number(form.admission_id)

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
    <div className="page print-page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Gate</p>
          <h2>Gate Visitors</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={() => window.print()} disabled={loading}>
            Print
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid no-print" onSubmit={handleStaffCheckIn}>
            <div className="panel-head full">
              <h3>Staff attendance</h3>
            </div>
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
            <div className="ui-field">
              <label htmlFor="staff_att_photo">Staff photo</label>
              <input
                id="staff_att_photo"
                className="ui-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                required
                onChange={(e) => setAttPhoto(e.target.files?.[0] || null)}
              />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingAtt}>
                {savingAtt ? 'Saving…' : 'Mark present'}
              </Button>
            </div>
          </form>

          <section className="panel no-print">
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

          <form className="panel form-grid no-print" onSubmit={handleSubmit}>
            <div className="panel-head full">
              <h3>Log visitor</h3>
            </div>
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
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="patient_search">Find patient</label>
              <input
                id="patient_search"
                className="ui-input"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search"
              />
            </div>
            <div className="ui-field">
              <label htmlFor="admission_id">Patient</label>
              <select
                id="admission_id"
                className="ui-select"
                value={form.admission_id}
                onChange={(e) => setField('admission_id', e.target.value)}
              >
                <option value="">None</option>
                {filteredAdmissions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.patient?.full_name || a.patient?.patient_code} — {a.admission_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Log visitor'}
              </Button>
            </div>
          </form>

          <header className="print-dash-head">
            <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
            <h2>Visitor log</h2>
          </header>

          <section className="panel">
            <div className="panel-head">
              <h3>Visitor log</h3>
              <input
                className="ui-input panel-search no-print"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search visitors"
              />
            </div>
            {visits.length === 0 ? (
              <p className="panel-copy">No visitors yet.</p>
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
                      <th className="no-print">Action</th>
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
                        <td className="no-print">
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
