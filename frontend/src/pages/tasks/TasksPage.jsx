import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  title: '',
  description: '',
  assigned_to: '',
  priority: 'medium',
  due_date: '',
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [taskRes, userRes] = await Promise.all([
        api('/staff-tasks?per_page=30'),
        api('/users?is_active=1&per_page=50').catch(() => ({ data: [] })),
      ])
      setTasks(taskRes.data || [])
      setUsers(userRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load tasks')
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
      const data = await api('/staff-tasks', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description || null,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          priority: form.priority,
          due_date: form.due_date || null,
        },
      })
      toast.success(`${data.data.task_code} created`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(task, status) {
    setUpdatingId(task.id)
    try {
      const data = await api(`/staff-tasks/${task.id}`, {
        method: 'PUT',
        body: { status },
      })
      toast.success(`${data.data.task_code} → ${data.data.status}`)
      load()
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2>Task & Duty Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field full">
              <label htmlFor="title">Title</label>
              <input id="title" className="ui-input" required value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="assigned_to">Assign to</label>
              <select id="assigned_to" className="ui-select" value={form.assigned_to} onChange={(e) => setField('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="priority">Priority</label>
              <select id="priority" className="ui-select" value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="due_date">Due date</label>
              <input id="due_date" className="ui-input" type="date" value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="description">Description</label>
              <input id="description" className="ui-input" value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create task'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Tasks</h3></div>
            {tasks.length === 0 ? (
              <p className="panel-copy">No tasks yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Assignee</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id}>
                        <td>{t.task_code}</td>
                        <td>{t.title}</td>
                        <td>{t.assignee?.name || '—'}</td>
                        <td><span className="badge">{t.priority}</span></td>
                        <td><span className="badge">{t.status}</span></td>
                        <td>
                          <div className="page-actions">
                            {t.status === 'pending' && (
                              <Button type="button" variant="secondary" disabled={updatingId === t.id} onClick={() => setStatus(t, 'in_progress')}>
                                Start
                              </Button>
                            )}
                            {(t.status === 'pending' || t.status === 'in_progress') && (
                              <Button type="button" disabled={updatingId === t.id} onClick={() => setStatus(t, 'completed')}>
                                Complete
                              </Button>
                            )}
                            {(t.status === 'completed' || t.status === 'cancelled') && (t.completed_at || '—')}
                          </div>
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
