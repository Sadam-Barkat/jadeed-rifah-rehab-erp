import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half day' },
  { value: 'leave', label: 'Leave' },
  { value: 'absent', label: 'Absent' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = {
  employee_id: '',
  attendance_date: todayStr(),
  status: 'present',
  check_in: '09:00',
  check_out: '',
  notes: '',
}

export default function AttendancePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState([])
  const [date, setDate] = useState(todayStr())
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load(selectedDate = date) {
    setLoading(true)
    try {
      const [empRes, attRes] = await Promise.all([
        api('/employees?status=active&per_page=50'),
        api(`/attendances?date=${selectedDate}&per_page=50`),
      ])
      setEmployees(empRes.data || [])
      setRows(attRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(date)
  }, [date])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api('/attendances', {
        method: 'POST',
        body: {
          employee_id: Number(form.employee_id),
          attendance_date: form.attendance_date || date,
          status: form.status,
          check_in: form.check_in || null,
          check_out: form.check_out || null,
          notes: form.notes || null,
        },
      })
      toast.success(`Marked ${data.data.employee?.full_name} · ${data.data.status}`)
      setForm({ ...emptyForm, attendance_date: date })
      load(date)
    } catch (err) {
      toast.error(err.message || 'Failed to mark attendance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">HR</p>
          <h2>Staff Attendance</h2>
        </div>
        <div className="page-actions">
          <input
            className="ui-input"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setForm((prev) => ({ ...prev, attendance_date: e.target.value }))
            }}
          />
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="employee_id">Employee</label>
              <select
                id="employee_id"
                className="ui-select"
                required
                value={form.employee_id}
                onChange={(e) => setField('employee_id', e.target.value)}
              >
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employee_code} · {e.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                className="ui-select"
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-field">
              <label htmlFor="check_in">Check-in</label>
              <input
                id="check_in"
                className="ui-input"
                type="time"
                value={form.check_in}
                onChange={(e) => setField('check_in', e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label htmlFor="check_out">Check-out</label>
              <input
                id="check_out"
                className="ui-input"
                type="time"
                value={form.check_out}
                onChange={(e) => setField('check_out', e.target.value)}
              />
            </div>

            <div className="ui-field full">
              <label htmlFor="notes">Notes</label>
              <input
                id="notes"
                className="ui-input"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>

            <div className="form-actions full">
              <Button type="submit" disabled={saving || !employees.length}>
                {saving ? 'Saving...' : 'Mark attendance'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Attendance · {date}</h3>
            </div>
            {rows.length === 0 ? (
              <p className="panel-copy">No attendance marked for this date.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.employee?.employee_code} · {r.employee?.full_name}
                        </td>
                        <td>{r.employee?.department || '—'}</td>
                        <td>
                          <span className="badge">{r.status}</span>
                        </td>
                        <td>{r.check_in || '—'}</td>
                        <td>{r.check_out || '—'}</td>
                        <td>{r.marked_by_name || '—'}</td>
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
