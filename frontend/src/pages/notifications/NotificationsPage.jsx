import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  user_id: '',
  broadcast: false,
  title: '',
  message: '',
  type: 'info',
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const canSend = (user?.modules || []).includes('notifications') || (user?.modules || []).includes('users')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const reqs = [api('/notifications?per_page=30')]
      if (canSend) reqs.push(api('/users?is_active=1&per_page=50').catch(() => ({ data: [] })))
      const [nRes, uRes] = await Promise.all(reqs)
      setItems(nRes.data || [])
      if (uRes) setUsers(uRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSend(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api('/notifications', {
        method: 'POST',
        body: {
          user_id: form.broadcast ? null : Number(form.user_id),
          broadcast: form.broadcast,
          title: form.title,
          message: form.message,
          type: form.type,
        },
      })
      toast.success(`Sent to ${data.data.count} user(s)`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Send failed')
    } finally {
      setSaving(false)
    }
  }

  async function markRead(n) {
    try {
      await api(`/notifications/${n.id}/read`, { method: 'POST', body: {} })
      load()
    } catch (err) {
      toast.error(err.message || 'Failed')
    }
  }

  async function markAll() {
    try {
      await api('/notifications/read-all', { method: 'POST', body: {} })
      toast.success('All marked as read')
      load()
    } catch (err) {
      toast.error(err.message || 'Failed')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">System</p>
          <h2>Notifications & Alerts</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={markAll}>Mark all read</Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          {canSend && (
            <form className="panel form-grid" onSubmit={handleSend}>
              <div className="panel-head full"><h3>Send notification</h3></div>
              <div className="ui-field">
                <label htmlFor="broadcast">Audience</label>
                <select
                  id="broadcast"
                  className="ui-select"
                  value={form.broadcast ? 'all' : 'one'}
                  onChange={(e) => setField('broadcast', e.target.value === 'all')}
                >
                  <option value="one">One user</option>
                  <option value="all">All active users</option>
                </select>
              </div>
              {!form.broadcast && (
                <div className="ui-field">
                  <label htmlFor="user_id">User</label>
                  <select id="user_id" className="ui-select" required value={form.user_id} onChange={(e) => setField('user_id', e.target.value)}>
                    <option value="">Select user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} · {u.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="ui-field">
                <label htmlFor="type">Type</label>
                <select id="type" className="ui-select" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                </select>
              </div>
              <div className="ui-field full">
                <label htmlFor="title">Title</label>
                <input id="title" className="ui-input" required value={form.title} onChange={(e) => setField('title', e.target.value)} />
              </div>
              <div className="ui-field full">
                <label htmlFor="message">Message</label>
                <input id="message" className="ui-input" required value={form.message} onChange={(e) => setField('message', e.target.value)} />
              </div>
              <div className="form-actions full">
                <Button type="submit" disabled={saving}>{saving ? 'Sending...' : 'Send'}</Button>
              </div>
            </form>
          )}

          <section className="panel">
            <div className="panel-head"><h3>My notifications</h3></div>
            {items.length === 0 ? (
              <p className="panel-copy">No notifications yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Message</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((n) => (
                      <tr key={n.id}>
                        <td>{n.title}</td>
                        <td>{n.message}</td>
                        <td><span className="badge">{n.type}</span></td>
                        <td>{n.is_read ? 'Read' : 'Unread'}</td>
                        <td>
                          {!n.is_read ? (
                            <Button type="button" variant="secondary" onClick={() => markRead(n)}>Mark read</Button>
                          ) : (n.created_at || '—')}
                        </td>
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
