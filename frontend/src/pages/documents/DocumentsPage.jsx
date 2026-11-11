import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const CATEGORIES = [
  { value: 'admin', label: 'Admin' },
  { value: 'patient', label: 'Patient' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'staff', label: 'Staff' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
]

const emptyForm = {
  title: '',
  category: 'admin',
  description: '',
  file: null,
}

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState(null)
  const [docs, setDocs] = useState([])
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    try {
      const res = await api('/documents?status=active&per_page=20')
      setDocs(res.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.file) {
      toast.error('Select a file')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('category', form.category)
      if (form.description) fd.append('description', form.description)
      fd.append('file', form.file)

      const data = await api('/documents', { method: 'POST', body: fd })
      toast.success(`${data.data.document_code} uploaded`)
      setForm(emptyForm)
      e.target.reset?.()
      load()
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  async function archiveDoc(doc) {
    setArchivingId(doc.id)
    try {
      const data = await api(`/documents/${doc.id}/archive`, { method: 'POST', body: {} })
      toast.success(`${data.data.document_code} archived`)
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
          <p className="eyebrow">Compliance</p>
          <h2>Digital Documents</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                className="ui-input"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                className="ui-select"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="description">Description</label>
              <input
                id="description"
                className="ui-input"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="file">File</label>
              <input
                id="file"
                className="ui-input"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>{saving ? 'Uploading...' : 'Upload document'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Documents</h3></div>
            {docs.length === 0 ? (
              <p className="panel-copy">No documents yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>File</th>
                      <th>By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id}>
                        <td>{d.document_code}</td>
                        <td>{d.title}</td>
                        <td><span className="badge">{d.category}</span></td>
                        <td>
                          {d.file_url ? (
                            <a href={d.file_url} target="_blank" rel="noreferrer">{d.original_name}</a>
                          ) : d.original_name}
                        </td>
                        <td>{d.uploaded_by_name || '—'}</td>
                        <td>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={archivingId === d.id}
                            onClick={() => archiveDoc(d)}
                          >
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
