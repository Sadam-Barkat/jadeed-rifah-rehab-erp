import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { medicineExpiryInfo } from '../../lib/format'
import Button from '../ui/Button'

const DEFAULT_CATEGORIES = [
  { value: 'analgesics', label: 'Analgesics' },
  { value: 'antibiotics', label: 'Antibiotics' },
  { value: 'antidepressants', label: 'Antidepressants' },
  { value: 'anxiolytics', label: 'Anxiolytics / sedatives' },
  { value: 'antipsychotics', label: 'Antipsychotics' },
  { value: 'vitamins', label: 'Vitamins & supplements' },
  { value: 'detox_support', label: 'Detox / withdrawal support' },
  { value: 'gastrointestinal', label: 'Gastrointestinal' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'antihistamines', label: 'Antihistamines' },
  { value: 'topical', label: 'Topical' },
  { value: 'iv_fluids', label: 'IV / fluids' },
  { value: 'other', label: 'Other' },
]

const FORM_TABS = [
  { value: 'all', label: 'All forms' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'injection', label: 'Injection' },
  { value: 'drops', label: 'Drops' },
  { value: 'cream', label: 'Cream' },
  { value: 'ointment', label: 'Ointment' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'powder', label: 'Powder' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'other', label: 'Other' },
]

export default function MedicinePicker({
  selectedId = '',
  onSelect,
  categories: categoriesProp,
}) {
  const [categories, setCategories] = useState(categoriesProp?.length ? categoriesProp : DEFAULT_CATEGORIES)
  const [category, setCategory] = useState('all')
  const [form, setForm] = useState('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  const categoryTabs = [{ value: 'all', label: 'All' }, ...categories]

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [category, form, debounced])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const q = new URLSearchParams({
          status: 'active',
          usable_only: '1',
          per_page: '40',
          page: String(page),
        })
        if (category && category !== 'all') q.set('category', category)
        if (form && form !== 'all') q.set('form', form)
        if (debounced) q.set('search', debounced)
        const res = await api(`/medicines?${q}`)
        if (cancelled) return
        setItems(res.data || [])
        setLastPage(res.meta?.last_page || 1)
        if (Array.isArray(res.meta?.categories) && res.meta.categories.length) {
          setCategories(res.meta.categories)
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load medicines')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [category, form, debounced, page])

  function handlePick(med) {
    const stock = Number(med.stock_qty || 0)
    const expired = medicineExpiryInfo(med.expiry_date)
    if (stock <= 0) {
      toast.error(`${med.name} is out of stock. Available: 0`)
    } else if (expired) {
      toast.error(`${med.name}: ${expired.label}`)
    } else if (med.low_stock) {
      toast.message(`${med.name} · Available: ${stock} ${med.unit || ''}`.trim())
    }
    onSelect?.(med)
  }

  return (
    <div className="med-picker">
      <div className="med-picker-tabs" role="tablist" aria-label="Medicine categories">
        {categoryTabs.map((cat) => (
          <button
            key={cat.value}
            type="button"
            role="tab"
            aria-selected={category === cat.value}
            className={`med-picker-tab${category === cat.value ? ' is-active' : ''}`}
            onClick={() => setCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="med-picker-tabs" role="tablist" aria-label="Medicine forms">
        {FORM_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={form === tab.value}
            className={`med-picker-tab${form === tab.value ? ' is-active' : ''}`}
            onClick={() => setForm(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="med-picker-toolbar">
        <input
          className="ui-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or code"
          aria-label="Search medicines"
        />
      </div>

      <div className="med-picker-list scroll-panel">
        {loading ? (
          <p className="panel-copy med-picker-empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="panel-copy med-picker-empty">No medicines found.</p>
        ) : (
          <ul className="med-picker-ul">
            {items.map((m) => {
              const active = String(selectedId) === String(m.id)
              const stock = Number(m.stock_qty || 0)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`med-picker-item${active ? ' is-active' : ''}`}
                    onClick={() => handlePick(m)}
                  >
                    <span className="med-picker-name">
                      {m.name}
                      {m.strength ? <small> · {m.strength}</small> : null}
                    </span>
                    <span className="med-picker-meta">
                      {m.medicine_code} · {m.form || '—'} · stock {stock} {m.unit}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {lastPage > 1 ? (
        <div className="med-picker-pager form-actions">
          <Button type="button" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="panel-copy">
            {page} / {lastPage}
          </span>
          <Button type="button" variant="ghost" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
