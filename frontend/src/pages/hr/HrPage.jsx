import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  full_name: '',
  father_name: '',
  cnic: '',
  phone: '',
  email: '',
  department: '',
  designation: '',
  join_date: '',
  employment_type: 'full_time',
  basic_salary: '',
  emergency_contact: '',
}

export default function HrPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const res = await api('/employees?status=active&per_page=50')
      setEmployees(res.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load employees')
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
      const data = await api('/employees', {
        method: 'POST',
        body: {
          full_name: form.full_name,
          father_name: form.father_name || null,
          cnic: form.cnic || null,
          phone: form.phone || null,
          email: form.email || null,
          department: form.department || null,
          designation: form.designation || null,
          join_date: form.join_date || null,
          employment_type: form.employment_type,
          basic_salary: form.basic_salary ? Number(form.basic_salary) : 0,
          emergency_contact: form.emergency_contact || null,
        },
      })
      toast.success(`${data.data.employee_code} created`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">HR</p>
          <h2>HR & Employee Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" className="ui-input" required value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="father_name">Father name</label>
              <input id="father_name" className="ui-input" value={form.father_name} onChange={(e) => setField('father_name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="cnic">CNIC</label>
              <input id="cnic" className="ui-input" value={form.cnic} onChange={(e) => setField('cnic', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" className="ui-input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="department">Department</label>
              <input id="department" className="ui-input" value={form.department} onChange={(e) => setField('department', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="designation">Designation</label>
              <input id="designation" className="ui-input" value={form.designation} onChange={(e) => setField('designation', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="join_date">Join date</label>
              <input id="join_date" className="ui-input" type="date" value={form.join_date} onChange={(e) => setField('join_date', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="employment_type">Employment type</label>
              <select id="employment_type" className="ui-select" value={form.employment_type} onChange={(e) => setField('employment_type', e.target.value)}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="basic_salary">Basic salary (PKR)</label>
              <input id="basic_salary" className="ui-input" type="number" min="0" value={form.basic_salary} onChange={(e) => setField('basic_salary', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="emergency_contact">Emergency contact</label>
              <input id="emergency_contact" className="ui-input" value={form.emergency_contact} onChange={(e) => setField('emergency_contact', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add employee'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Employees</h3>
            </div>
            {employees.length === 0 ? (
              <p className="panel-copy">No employees yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Salary</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id}>
                        <td>{e.employee_code}</td>
                        <td>{e.full_name}</td>
                        <td>{e.department || '—'}</td>
                        <td>{e.designation || '—'}</td>
                        <td>{formatPkr(e.basic_salary)}</td>
                        <td><span className="badge">{e.status}</span></td>
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
