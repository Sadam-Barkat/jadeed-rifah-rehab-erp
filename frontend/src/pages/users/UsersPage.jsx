import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  name: '',
  email: '',
  role_id: '',
}

export default function UsersPage({ embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [credentials, setCredentials] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const q = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''
      const [roleRes, userRes] = await Promise.all([
        api('/roles'),
        api(`/users?per_page=50${q}`),
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
          email: form.email.trim(),
          role_id: Number(form.role_id),
          generate_password: true,
        },
      })
      toast.success(`${data.data.name} created`)
      setCredentials(data.credentials || null)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create staff')
    } finally {
      setSaving(false)
    }
  }

  async function resetPassword(user) {
    try {
      const data = await api(`/users/${user.id}`, {
        method: 'PUT',
        body: { reset_password: true },
      })
      setCredentials(data.credentials || null)
      toast.success('Password reset')
    } catch (err) {
      toast.error(err.message || 'Reset failed')
    }
  }

  async function confirmDelete() {
    if (!deleteUser) return
    try {
      await api(`/users/${deleteUser.id}`, { method: 'DELETE' })
      toast.success('Staff deleted')
      setDeleteUser(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  async function copyCreds() {
    if (!credentials) return
    const text = `Login: ${credentials.email}\nPassword: ${credentials.temporary_password}\nCode: ${credentials.staff_code || ''}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <div className={embedded ? 'embedded-page' : 'page'}>
      {embedded ? null : (
        <div className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Staff & Users</h2>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="name">Full name</label>
              <input id="name" className="ui-input" required value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="ui-input" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="role_id">Role</label>
              <select id="role_id" className="ui-select" required value={form.role_id} onChange={(e) => setField('role_id', e.target.value)}>
                <option value="">Select</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create staff'}</Button>
            </div>
          </form>

          <div className="panel">
            <div className="list-toolbar">
              <input className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff" />
              <Button type="button" variant="secondary" onClick={load}>Search</Button>
            </div>
            <div className="scroll-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={6}>No staff</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.staff_code || '—'}</td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role?.name || '—'}</td>
                      <td>{u.is_active ? 'Active' : 'Inactive'}</td>
                      <td className="actions">
                        <Button type="button" variant="secondary" size="sm" onClick={() => resetPassword(u)}>Reset password</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDeleteUser(u)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        open={Boolean(credentials)}
        title="Staff login"
        confirmLabel="Copy"
        onClose={() => setCredentials(null)}
        onConfirm={copyCreds}
      >
        {credentials ? (
          <div>
            <p>Code: {credentials.staff_code || '—'}</p>
            <p>Email: {credentials.email}</p>
            <p>Password: {credentials.temporary_password}</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteUser)}
        title="Delete staff"
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteUser(null)}
        onConfirm={confirmDelete}
      >
        Delete {deleteUser?.name}? This cannot be undone.
      </Modal>
    </div>
  )
}
