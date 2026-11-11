import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyFacility = {
  facility_name: '',
  short_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  timezone: 'Asia/Karachi',
  currency: 'PKR',
  session_timeout_minutes: '60',
}

const emptyBackup = {
  storage_note: '',
  notes: '',
  status: 'success',
  method: 'manual',
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [savingFacility, setSavingFacility] = useState(false)
  const [savingBackup, setSavingBackup] = useState(false)
  const [facility, setFacility] = useState(emptyFacility)
  const [backups, setBackups] = useState([])
  const [audits, setAudits] = useState([])
  const [backupForm, setBackupForm] = useState(emptyBackup)

  async function load() {
    setLoading(true)
    try {
      const [facRes, bkpRes, auditRes] = await Promise.all([
        api('/settings/facility'),
        api('/settings/backups?per_page=20'),
        api('/audit-logs?per_page=20'),
      ])
      const f = facRes.data || {}
      setFacility({
        facility_name: f.facility_name || '',
        short_name: f.short_name || '',
        phone: f.phone || '',
        email: f.email || '',
        address: f.address || '',
        city: f.city || '',
        timezone: f.timezone || 'Asia/Karachi',
        currency: f.currency || 'PKR',
        session_timeout_minutes: String(f.session_timeout_minutes ?? 60),
      })
      setBackups(bkpRes.data || [])
      setAudits(auditRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleFacilitySubmit(e) {
    e.preventDefault()
    setSavingFacility(true)
    try {
      const data = await api('/settings/facility', {
        method: 'PUT',
        body: {
          facility_name: facility.facility_name,
          short_name: facility.short_name || null,
          phone: facility.phone || null,
          email: facility.email || null,
          address: facility.address || null,
          city: facility.city || null,
          timezone: facility.timezone || 'Asia/Karachi',
          currency: facility.currency || 'PKR',
          session_timeout_minutes: Number(facility.session_timeout_minutes) || 60,
        },
      })
      toast.success('Facility settings saved')
      setFacility({
        ...facility,
        facility_name: data.data.facility_name,
        short_name: data.data.short_name || '',
        phone: data.data.phone || '',
        email: data.data.email || '',
        address: data.data.address || '',
        city: data.data.city || '',
        timezone: data.data.timezone,
        currency: data.data.currency,
        session_timeout_minutes: String(data.data.session_timeout_minutes),
      })
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setSavingFacility(false)
    }
  }

  async function handleBackupSubmit(e) {
    e.preventDefault()
    setSavingBackup(true)
    try {
      const data = await api('/settings/backups', {
        method: 'POST',
        body: {
          method: backupForm.method,
          status: backupForm.status,
          storage_note: backupForm.storage_note || null,
          notes: backupForm.notes || null,
        },
      })
      toast.success(`${data.data.backup_code} recorded`)
      setBackupForm(emptyBackup)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to record backup')
    } finally {
      setSavingBackup(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">System</p>
          <h2>System Settings & Backup</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleFacilitySubmit}>
            <div className="ui-field">
              <label htmlFor="facility_name">Facility name</label>
              <input id="facility_name" className="ui-input" required value={facility.facility_name} onChange={(e) => setFacility((p) => ({ ...p, facility_name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="short_name">Short name</label>
              <input id="short_name" className="ui-input" value={facility.short_name} onChange={(e) => setFacility((p) => ({ ...p, short_name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" className="ui-input" value={facility.phone} onChange={(e) => setFacility((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="ui-input" value={facility.email} onChange={(e) => setFacility((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="city">City</label>
              <input id="city" className="ui-input" value={facility.city} onChange={(e) => setFacility((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="session_timeout_minutes">Session timeout (min)</label>
              <input id="session_timeout_minutes" type="number" min="15" max="720" className="ui-input" value={facility.session_timeout_minutes} onChange={(e) => setFacility((p) => ({ ...p, session_timeout_minutes: e.target.value }))} />
            </div>
            <div className="ui-field full">
              <label htmlFor="address">Address</label>
              <input id="address" className="ui-input" value={facility.address} onChange={(e) => setFacility((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingFacility}>{savingFacility ? 'Saving…' : 'Save settings'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleBackupSubmit}>
            <div className="ui-field">
              <label htmlFor="method">Method</label>
              <select id="method" className="ui-select" value={backupForm.method} onChange={(e) => setBackupForm((p) => ({ ...p, method: e.target.value }))}>
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="status">Status</label>
              <select id="status" className="ui-select" value={backupForm.status} onChange={(e) => setBackupForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="storage_note">Storage note</label>
              <input id="storage_note" className="ui-input" value={backupForm.storage_note} onChange={(e) => setBackupForm((p) => ({ ...p, storage_note: e.target.value }))} />
            </div>
            <div className="ui-field full">
              <label htmlFor="notes">Notes</label>
              <input id="notes" className="ui-input" value={backupForm.notes} onChange={(e) => setBackupForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingBackup}>{savingBackup ? 'Saving…' : 'Log backup'}</Button>
            </div>
          </form>

          <div className="panel">
            <h3>Backup log</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>When</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Storage</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr><td colSpan={6}>No backups logged</td></tr>
                  ) : backups.map((b) => (
                    <tr key={b.id}>
                      <td>{b.backup_code}</td>
                      <td>{b.backed_up_at || '—'}</td>
                      <td>{b.method}</td>
                      <td>{b.status}</td>
                      <td>{b.storage_note || '—'}</td>
                      <td>{b.recorded_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Audit log</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.length === 0 ? (
                    <tr><td colSpan={5}>No audit entries</td></tr>
                  ) : audits.map((a) => (
                    <tr key={a.id}>
                      <td>{a.created_at || '—'}</td>
                      <td>{a.user || '—'}</td>
                      <td>{a.action}</td>
                      <td>{a.module || '—'}</td>
                      <td>{a.summary || '—'}</td>
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
