import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyCamera = { location: '', zone: '', status: 'online' }
const emptyIncident = { title: '', location: '', severity: 'medium', description: '', action_taken: '' }
const emptyShift = { guard_name: '', shift: 'morning', check_in_at: '', notes: '' }

export default function SecurityPage() {
  const [loading, setLoading] = useState(true)
  const [savingCamera, setSavingCamera] = useState(false)
  const [savingIncident, setSavingIncident] = useState(false)
  const [savingShift, setSavingShift] = useState(false)
  const [cameras, setCameras] = useState([])
  const [incidents, setIncidents] = useState([])
  const [shifts, setShifts] = useState([])
  const [cameraForm, setCameraForm] = useState(emptyCamera)
  const [incidentForm, setIncidentForm] = useState(emptyIncident)
  const [shiftForm, setShiftForm] = useState(emptyShift)

  async function load() {
    setLoading(true)
    try {
      const [camRes, incRes, sftRes] = await Promise.all([
        api('/security-cameras?per_page=50'),
        api('/security-incidents?per_page=20'),
        api('/security-shifts?per_page=20'),
      ])
      setCameras(camRes.data || [])
      setIncidents(incRes.data || [])
      setShifts(sftRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load security data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCameraSubmit(e) {
    e.preventDefault()
    setSavingCamera(true)
    try {
      const data = await api('/security-cameras', {
        method: 'POST',
        body: {
          location: cameraForm.location,
          zone: cameraForm.zone || null,
          status: cameraForm.status,
        },
      })
      toast.success(`${data.data.camera_code} registered`)
      setCameraForm(emptyCamera)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to register camera')
    } finally {
      setSavingCamera(false)
    }
  }

  async function handleIncidentSubmit(e) {
    e.preventDefault()
    setSavingIncident(true)
    try {
      const data = await api('/security-incidents', {
        method: 'POST',
        body: {
          title: incidentForm.title,
          location: incidentForm.location || null,
          severity: incidentForm.severity,
          description: incidentForm.description || null,
          action_taken: incidentForm.action_taken || null,
        },
      })
      toast.success(`${data.data.incident_code} recorded`)
      setIncidentForm(emptyIncident)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to record incident')
    } finally {
      setSavingIncident(false)
    }
  }

  async function handleShiftSubmit(e) {
    e.preventDefault()
    setSavingShift(true)
    try {
      const data = await api('/security-shifts', {
        method: 'POST',
        body: {
          guard_name: shiftForm.guard_name,
          shift: shiftForm.shift,
          check_in_at: shiftForm.check_in_at || null,
          notes: shiftForm.notes || null,
          status: 'on_duty',
        },
      })
      toast.success(`${data.data.shift_code} logged`)
      setShiftForm(emptyShift)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to log shift')
    } finally {
      setSavingShift(false)
    }
  }

  async function completeShift(row) {
    try {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const data = await api(`/security-shifts/${row.id}`, {
        method: 'PUT',
        body: { status: 'completed', check_out_at: `${hh}:${mm}` },
      })
      toast.success(`${data.data.shift_code} completed`)
      load()
    } catch (err) {
      toast.error(err.message || 'Update failed')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>CCTV & Security</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleCameraSubmit}>
            <div className="ui-field">
              <label htmlFor="location">Camera location</label>
              <input id="location" className="ui-input" required value={cameraForm.location} onChange={(e) => setCameraForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="zone">Zone</label>
              <input id="zone" className="ui-input" value={cameraForm.zone} onChange={(e) => setCameraForm((p) => ({ ...p, zone: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="cam_status">Status</label>
              <select id="cam_status" className="ui-select" value={cameraForm.status} onChange={(e) => setCameraForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingCamera}>{savingCamera ? 'Saving…' : 'Register camera'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleIncidentSubmit}>
            <div className="ui-field">
              <label htmlFor="title">Incident title</label>
              <input id="title" className="ui-input" required value={incidentForm.title} onChange={(e) => setIncidentForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="inc_location">Location</label>
              <input id="inc_location" className="ui-input" value={incidentForm.location} onChange={(e) => setIncidentForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="severity">Severity</label>
              <select id="severity" className="ui-select" value={incidentForm.severity} onChange={(e) => setIncidentForm((p) => ({ ...p, severity: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="description">Description</label>
              <textarea id="description" className="ui-textarea" rows={2} value={incidentForm.description} onChange={(e) => setIncidentForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="ui-field full">
              <label htmlFor="action_taken">Action taken</label>
              <textarea id="action_taken" className="ui-textarea" rows={2} value={incidentForm.action_taken} onChange={(e) => setIncidentForm((p) => ({ ...p, action_taken: e.target.value }))} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingIncident}>{savingIncident ? 'Saving…' : 'Record incident'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleShiftSubmit}>
            <div className="ui-field">
              <label htmlFor="guard_name">Guard name</label>
              <input id="guard_name" className="ui-input" required value={shiftForm.guard_name} onChange={(e) => setShiftForm((p) => ({ ...p, guard_name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="shift">Shift</label>
              <select id="shift" className="ui-select" value={shiftForm.shift} onChange={(e) => setShiftForm((p) => ({ ...p, shift: e.target.value }))}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="check_in_at">Check-in</label>
              <input id="check_in_at" type="time" className="ui-input" value={shiftForm.check_in_at} onChange={(e) => setShiftForm((p) => ({ ...p, check_in_at: e.target.value }))} />
            </div>
            <div className="ui-field full">
              <label htmlFor="notes">Notes</label>
              <input id="notes" className="ui-input" value={shiftForm.notes} onChange={(e) => setShiftForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingShift}>{savingShift ? 'Saving…' : 'Log shift'}</Button>
            </div>
          </form>

          <div className="panel">
            <h3>Camera inventory</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Zone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cameras.length === 0 ? (
                    <tr><td colSpan={4}>No cameras</td></tr>
                  ) : cameras.map((c) => (
                    <tr key={c.id}>
                      <td>{c.camera_code}</td>
                      <td>{c.location}</td>
                      <td>{c.zone || '—'}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Incidents</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.length === 0 ? (
                    <tr><td colSpan={5}>No incidents</td></tr>
                  ) : incidents.map((i) => (
                    <tr key={i.id}>
                      <td>{i.incident_code}</td>
                      <td>{i.title}</td>
                      <td>{i.severity}</td>
                      <td>{i.location || '—'}</td>
                      <td>{i.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Shifts</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Guard</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr><td colSpan={6}>No shifts</td></tr>
                  ) : shifts.map((s) => (
                    <tr key={s.id}>
                      <td>{s.shift_code}</td>
                      <td>{s.shift_date}</td>
                      <td>{s.shift}</td>
                      <td>{s.guard_name}</td>
                      <td>{s.status}</td>
                      <td>
                        {s.status === 'on_duty' ? (
                          <Button type="button" variant="secondary" onClick={() => completeShift(s)}>Complete</Button>
                        ) : '—'}
                      </td>
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
