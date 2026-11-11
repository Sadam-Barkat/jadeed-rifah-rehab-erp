import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role_id: '',
  is_active: true,
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [roleRes, userRes] = await Promise.all([
        api('/roles'),
        api('/users?per_page=50'),
      ])
      setRoles(roleRes.data || [])
      setUsers(userRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load users')
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
      const data = await api('/users', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          role_id: Number(form.role_id),
          is_active: true,
        },
      })
      toast.success(`${data.data.name} created`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user) {
    setTogglingId(user.id)
    try {
      const data = await api(`/users/${user.id}`, {
        method: 'PUT',
        body: { is_active: !user.is_active },
      })
      toast.success(`${data.data.name} ${data.data.is_active ? 'activated' : 'deactivated'}`)
      load()
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">HR</p>
          <h2>User & Permissions</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="email">Email</label>
              <input id="email" className="ui-input" type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="password">Password</label>
              <input id="password" className="ui-input" type="password" required minLength={8} value={form.password} onChange={(e) => setField('password', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="role_id">Role</label>
              <select id="role_id" className="ui-select" required value={form.role_id} onChange={(e) => setField('role_id', e.target.value)}>
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving || !roles.length}>{saving ? 'Saving...' : 'Create user'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Users</h3></div>
            {users.length === 0 ? (
              <p className="panel-copy">No users found.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.role?.name || '—'}</td>
                        <td><span className="badge">{u.is_active ? 'active' : 'inactive'}</span></td>
                        <td>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={togglingId === u.id}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
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
