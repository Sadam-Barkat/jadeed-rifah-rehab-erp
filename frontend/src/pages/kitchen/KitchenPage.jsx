import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = {
  menu_date: todayStr(),
  meal_type: 'lunch',
  menu_items: '',
  portions: '',
  notes: '',
}

export default function KitchenPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [menus, setMenus] = useState([])
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const res = await api('/kitchen-menus?per_page=30')
      setMenus(res.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load kitchen menus')
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
      const data = await api('/kitchen-menus', {
        method: 'POST',
        body: {
          menu_date: form.menu_date,
          meal_type: form.meal_type,
          menu_items: form.menu_items,
          portions: form.portions ? Number(form.portions) : null,
          notes: form.notes || null,
        },
      })
      toast.success(`${data.data.menu_code} saved`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save menu')
    } finally {
      setSaving(false)
    }
  }

  async function markServed(menu) {
    setUpdatingId(menu.id)
    try {
      const data = await api(`/kitchen-menus/${menu.id}`, {
        method: 'PUT',
        body: { status: 'served' },
      })
      toast.success(`${data.data.menu_code} marked served`)
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
          <p className="eyebrow">Operations</p>
          <h2>Kitchen Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="ui-field">
              <label htmlFor="menu_date">Date</label>
              <input
                id="menu_date"
                className="ui-input"
                type="date"
                required
                value={form.menu_date}
                onChange={(e) => setField('menu_date', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="meal_type">Meal</label>
              <select
                id="meal_type"
                className="ui-select"
                value={form.meal_type}
                onChange={(e) => setField('meal_type', e.target.value)}
              >
                {MEALS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="portions">Portions</label>
              <input
                id="portions"
                className="ui-input"
                type="number"
                min="1"
                value={form.portions}
                onChange={(e) => setField('portions', e.target.value)}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="menu_items">Menu items</label>
              <input
                id="menu_items"
                className="ui-input"
                required
                value={form.menu_items}
                onChange={(e) => setField('menu_items', e.target.value)}
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
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save menu'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Menus</h3>
            </div>
            {menus.length === 0 ? (
              <p className="panel-copy">No kitchen menus yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Date</th>
                      <th>Meal</th>
                      <th>Items</th>
                      <th>Portions</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menus.map((m) => (
                      <tr key={m.id}>
                        <td>{m.menu_code}</td>
                        <td>{m.menu_date}</td>
                        <td>
                          <span className="badge">{m.meal_type}</span>
                        </td>
                        <td>{m.menu_items}</td>
                        <td>{m.portions || '—'}</td>
                        <td>
                          <span className="badge">{m.status}</span>
                        </td>
                        <td>
                          {m.status === 'planned' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={updatingId === m.id}
                              onClick={() => markServed(m)}
                            >
                              Mark served
                            </Button>
                          ) : (
                            '—'
                          )}
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
