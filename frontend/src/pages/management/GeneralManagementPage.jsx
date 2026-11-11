import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  title: '',
  body: '',
  category: 'operational',
}

export default function GeneralManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState(null)
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const res = await api('/management-notes?status=active&per_page=30')
      setNotes(res.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load notes')
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
      const data = await api('/management-notes', {
        method: 'POST',
        body: {
          title: form.title,
          body: form.body,
          category: form.category,
        },
      })
      toast.success(`${data.data.note_code} saved`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  async function archiveNote(note) {
    setArchivingId(note.id)
    try {
      const data = await api(`/management-notes/${note.id}/archive`, { method: 'POST', body: {} })
      toast.success(`${data.data.note_code} archived`)
      load()
    } catch (err) {
      toast.error(err.message || 'Archive failed')
    } finally {
      setArchivingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Management</p>
          <h2>General Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="title">Title</label>
              <input id="title" className="ui-input" required value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <select id="category" className="ui-select" value={form.category} onChange={(e) => setField('category', e.target.value)}>
                <option value="operational">Operational</option>
                <option value="announcement">Announcement</option>
                <option value="policy">Policy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="body">Details</label>
              <input id="body" className="ui-input" required value={form.body} onChange={(e) => setField('body', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save note'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Active notes</h3></div>
            {notes.length === 0 ? (
              <p className="panel-copy">No management notes yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((n) => (
                      <tr key={n.id}>
                        <td>{n.note_code}</td>
                        <td>
                          <div>{n.title}</div>
                          <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{n.body}</div>
                        </td>
                        <td><span className="badge">{n.category}</span></td>
                        <td>{n.created_by_name || '—'}</td>
                        <td>
                          <Button type="button" variant="secondary" disabled={archivingId === n.id} onClick={() => archiveNote(n)}>
                            Archive
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
