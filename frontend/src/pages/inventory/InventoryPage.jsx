import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

const PURPOSES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'kitchen_use', label: 'Kitchen use' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'patient_care', label: 'Patient care' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'return', label: 'Return' },
  { value: 'waste', label: 'Waste / discard' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'other', label: 'Other' },
]

const CATEGORIES = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'beds', label: 'Beds' },
  { value: 'security', label: 'Security / cameras' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'linen', label: 'Linen' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'medical_supply', label: 'Medical supply (non-medicine)' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
]

const DEPARTMENTS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'admin', label: 'Admin' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'gate', label: 'Gate' },
  { value: 'other', label: 'Other' },
]

const emptyItem = {
  name: '',
  category: 'kitchen',
  unit: 'pcs',
  stock_qty: '',
  reorder_level: '10',
  unit_cost: '',
  supplier: '',
  bill_image: null,
}

const emptyMove = {
  inventory_item_id: '',
  type: 'out',
  quantity: '',
  purpose: 'kitchen_use',
  department: 'kitchen',
  issued_to: '',
  used_for: '',
  reference: '',
  notes: '',
  bed_id: '',
  bed_action: 'maintenance',
}

function labelOf(list, value) {
  return list.find((x) => x.value === value)?.label || value || '—'
}

export default function InventoryPage() {
  const { user } = useAuth()
  const canUseInventory = (user?.modules || []).includes('inventory')
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingMove, setSavingMove] = useState(false)
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [itemForm, setItemForm] = useState(emptyItem)
  const [moveForm, setMoveForm] = useState(() => ({
    ...emptyMove,
    issued_to: '',
  }))
  const [itemSearch, setItemSearch] = useState('')
  const [moveType, setMoveType] = useState('')
  const [movePurpose, setMovePurpose] = useState('')
  const [moveDepartment, setMoveDepartment] = useState('')
  const [moveStaff, setMoveStaff] = useState('')
  const [moveQuery, setMoveQuery] = useState('')
  const [debouncedMoveQuery, setDebouncedMoveQuery] = useState('')
  const [staff, setStaff] = useState([])
  const [moveBill, setMoveBill] = useState(null)
  const [beds, setBeds] = useState([])

  function setItem(key, value) {
    setItemForm((prev) => ({ ...prev, [key]: value }))
  }

  function setMove(key, value) {
    setMoveForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedItem = useMemo(
    () => items.find((i) => String(i.id) === String(moveForm.inventory_item_id)),
    [items, moveForm.inventory_item_id]
  )
  const isBedsItem = selectedItem?.category === 'beds'
  const selectedBed = useMemo(
    () => beds.find((b) => String(b.id) === String(moveForm.bed_id)),
    [beds, moveForm.bed_id]
  )

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMoveQuery(moveQuery.trim()), 350)
    return () => clearTimeout(t)
  }, [moveQuery])

  async function loadItems() {
    const itemRes = await api('/inventory-items?status=active&per_page=100')
    setItems(itemRes.data || [])
  }

  async function loadBeds() {
    const res = await api('/inventory-beds')
    setBeds(res.data || [])
  }

  async function loadMovements() {
    const q = new URLSearchParams({ per_page: '50' })
    if (moveType) q.set('type', moveType)
    if (movePurpose) q.set('purpose', movePurpose)
    if (moveDepartment) q.set('department', moveDepartment)
    if (moveStaff) q.set('created_by', moveStaff)
    if (debouncedMoveQuery) q.set('q', debouncedMoveQuery)
    const moveRes = await api(`/inventory-movements?${q}`)
    setMovements(moveRes.data || [])
    if (moveRes.meta?.staff) setStaff(moveRes.meta.staff)
  }

  async function load() {
    setLoading(true)
    try {
      await Promise.all([loadItems(), loadMovements(), loadBeds()])
    } catch (err) {
      toast.error(err.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canUseInventory) return
    load()
  }, [canUseInventory])

  useEffect(() => {
    if (!user?.name) return
    setMoveForm((prev) => ({
      ...prev,
      issued_to: prev.issued_to || user.name,
    }))
  }, [user?.name])

  useEffect(() => {
    if (!canUseInventory || loading) return
    loadMovements().catch((err) => toast.error(err.message || 'Failed to filter movements'))
  }, [moveType, movePurpose, moveDepartment, moveStaff, debouncedMoveQuery])

  useEffect(() => {
    if (isBedsItem) {
      if (moveForm.type === 'adjust') setMove('type', 'out')
      if (moveForm.type === 'in' && moveForm.purpose !== 'purchase') setMove('purpose', 'purchase')
      if (moveForm.type === 'out' && !['maintenance', 'waste'].includes(moveForm.purpose)) {
        setMove('purpose', moveForm.bed_action === 'discard' ? 'waste' : 'maintenance')
      }
      return
    }
    if (moveForm.type === 'in' && moveForm.purpose === 'kitchen_use') {
      setMove('purpose', 'purchase')
    }
    if (moveForm.type === 'out' && moveForm.purpose === 'purchase') {
      setMove('purpose', 'kitchen_use')
    }
  }, [moveForm.type, isBedsItem])

  useEffect(() => {
    if (!isBedsItem || moveForm.type !== 'out') return
    setMove('purpose', moveForm.bed_action === 'discard' ? 'waste' : 'maintenance')
    setMove('department', 'maintenance')
  }, [moveForm.bed_action, isBedsItem, moveForm.type])

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (i) =>
        String(i.name || '').toLowerCase().includes(q) ||
        String(i.item_code || '').toLowerCase().includes(q) ||
        String(i.category || '').toLowerCase().includes(q)
    )
  }, [items, itemSearch])

  if (!canUseInventory) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  async function handleAddItem(e) {
    e.preventDefault()
    setSavingItem(true)
    try {
      const fd = new FormData()
      fd.append('name', itemForm.name)
      fd.append('category', itemForm.category)
      fd.append('unit', itemForm.unit || 'unit')
      fd.append('stock_qty', String(itemForm.stock_qty ? Number(itemForm.stock_qty) : 0))
      fd.append('reorder_level', String(itemForm.reorder_level ? Number(itemForm.reorder_level) : 10))
      fd.append('unit_cost', String(itemForm.unit_cost ? Number(itemForm.unit_cost) : 0))
      if (itemForm.supplier) fd.append('supplier', itemForm.supplier)
      if (itemForm.bill_image) fd.append('bill_image', itemForm.bill_image)

      const data = await api('/inventory-items', {
        method: 'POST',
        body: fd,
      })
      toast.success(data.message || `${data.data.item_code} added`)
      setItemForm(emptyItem)
      await loadItems()
    } catch (err) {
      toast.error(err.message || 'Failed to add item')
    } finally {
      setSavingItem(false)
    }
  }

  async function handleMove(e) {
    e.preventDefault()
    if (isBedsItem && moveForm.type === 'out') {
      if (!moveForm.bed_id) {
        toast.error('Select a bed')
        return
      }
      if (selectedBed?.in_use) {
        toast.error('Bed is in use. Discharge the patient first.')
        return
      }
    }
    setSavingMove(true)
    try {
      const fd = new FormData()
      fd.append('inventory_item_id', String(Number(moveForm.inventory_item_id)))
      fd.append('type', moveForm.type)

      if (isBedsItem && moveForm.type === 'out') {
        fd.append('bed_id', String(Number(moveForm.bed_id)))
        fd.append('bed_action', moveForm.bed_action)
        fd.append('quantity', '1')
        fd.append('purpose', moveForm.bed_action === 'discard' ? 'waste' : 'maintenance')
        fd.append('department', 'maintenance')
        fd.append('used_for', moveForm.bed_action === 'discard' ? 'Bed total discard' : 'Bed maintenance')
      } else {
        fd.append('quantity', String(Number(moveForm.quantity)))
        fd.append('purpose', moveForm.purpose)
        if (moveForm.department) fd.append('department', moveForm.department)
        if (moveForm.used_for) fd.append('used_for', moveForm.used_for)
      }

      const issuedTo = moveForm.type === 'out' ? (user?.name || moveForm.issued_to || '') : (moveForm.issued_to || '')
      if (issuedTo) fd.append('issued_to', issuedTo)
      if (moveForm.reference) fd.append('reference', moveForm.reference)
      if (moveForm.notes) fd.append('notes', moveForm.notes)
      if (moveBill && (moveForm.type === 'in' || moveForm.type === 'adjust')) {
        fd.append('bill_image', moveBill)
      }

      const data = await api('/inventory-movements', {
        method: 'POST',
        body: fd,
      })
      toast.success(data.message || `${data.data.movement_code} recorded`)
      setMoveForm({
        ...emptyMove,
        issued_to: user?.name || '',
        type: isBedsItem ? 'in' : 'out',
        purpose: isBedsItem ? 'purchase' : 'kitchen_use',
        inventory_item_id: moveForm.inventory_item_id,
      })
      setMoveBill(null)
      await Promise.all([loadItems(), loadMovements(), loadBeds()])
    } catch (err) {
      toast.error(err.message || 'Movement failed')
    } finally {
      setSavingMove(false)
    }
  }

  const isOut = moveForm.type === 'out'
  const bedsActionMode = isBedsItem && isOut

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Inventory & Stock</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleAddItem}>
            <div className="panel-head full">
              <h3>Add item</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={itemForm.name} onChange={(e) => setItem('name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <select id="category" className="ui-select" value={itemForm.category} onChange={(e) => setItem('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="unit">Unit</label>
              <input id="unit" className="ui-input" value={itemForm.unit} onChange={(e) => setItem('unit', e.target.value)} placeholder="pcs / kg / liter" />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_qty">Opening stock</label>
              <input id="stock_qty" className="ui-input" type="number" min="0" step="0.01" value={itemForm.stock_qty} onChange={(e) => setItem('stock_qty', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="unit_cost">Unit cost (PKR)</label>
              <input id="unit_cost" className="ui-input" type="number" min="0" step="0.01" value={itemForm.unit_cost} onChange={(e) => setItem('unit_cost', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="supplier">Supplier</label>
              <input id="supplier" className="ui-input" value={itemForm.supplier} onChange={(e) => setItem('supplier', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="bill_image">Bill image</label>
              <input
                id="bill_image"
                className="ui-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setItem('bill_image', e.target.files?.[0] || null)}
              />
            </div>
            <div className="ui-field">
              <label>Recorded by</label>
              <input className="ui-input" value={user?.name || '—'} readOnly />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingItem}>{savingItem ? 'Saving...' : 'Add item'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleMove}>
            <div className="panel-head full">
              <h3>{isBedsItem ? 'Beds stock / maintenance' : 'Stock in / out'}</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="inventory_item_id">Item</label>
              <select
                id="inventory_item_id"
                className="ui-select"
                required
                value={moveForm.inventory_item_id}
                onChange={(e) => {
                  const nextId = e.target.value
                  const next = items.find((i) => String(i.id) === String(nextId))
                  setMoveForm((prev) => ({
                    ...prev,
                    inventory_item_id: nextId,
                    type: next?.category === 'beds' ? 'in' : prev.type === 'adjust' ? 'out' : prev.type,
                    purpose: next?.category === 'beds' ? 'purchase' : prev.purpose,
                    bed_id: '',
                    bed_action: 'maintenance',
                    quantity: next?.category === 'beds' ? '' : prev.quantity,
                  }))
                }}
              >
                <option value="">Select item</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.stock_qty} {i.unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="type">Type</label>
              <select id="type" className="ui-select" value={moveForm.type} onChange={(e) => setMove('type', e.target.value)}>
                <option value="in">Stock in</option>
                {isBedsItem ? (
                  <option value="out">Bed maintenance / discard</option>
                ) : (
                  <>
                    <option value="out">Stock out</option>
                    <option value="adjust">Adjust to qty</option>
                  </>
                )}
              </select>
            </div>
            {bedsActionMode ? (
              <>
                <div className="ui-field">
                  <label htmlFor="bed_id">Bed</label>
                  <select
                    id="bed_id"
                    className="ui-select"
                    required
                    value={moveForm.bed_id}
                    onChange={(e) => setMove('bed_id', e.target.value)}
                  >
                    <option value="">Select bed</option>
                    {beds.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.in_use}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ui-field">
                  <label htmlFor="bed_action">Action</label>
                  <select
                    id="bed_action"
                    className="ui-select"
                    required
                    value={moveForm.bed_action}
                    onChange={(e) => setMove('bed_action', e.target.value)}
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="discard">Total discard</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="ui-field">
                <label htmlFor="quantity">Quantity {selectedItem?.unit ? `(${selectedItem.unit})` : ''}</label>
                <input id="quantity" className="ui-input" type="number" min="0.01" step="0.01" required value={moveForm.quantity} onChange={(e) => setMove('quantity', e.target.value)} />
              </div>
            )}
            {!bedsActionMode ? (
              <div className="ui-field">
                <label htmlFor="purpose">Purpose</label>
                <select id="purpose" className="ui-select" required value={moveForm.purpose} onChange={(e) => setMove('purpose', e.target.value)}>
                  {PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {!bedsActionMode ? (
              <div className="ui-field">
                <label htmlFor="department">Department</label>
                <select id="department" className="ui-select" required={isOut} value={moveForm.department} onChange={(e) => setMove('department', e.target.value)}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="ui-field">
              <label htmlFor="issued_to">{isOut ? 'Used by' : 'Received from'}</label>
              <input
                id="issued_to"
                className="ui-input"
                required={isOut}
                value={isOut ? (user?.name || moveForm.issued_to) : moveForm.issued_to}
                readOnly={isOut}
                onChange={(e) => setMove('issued_to', e.target.value)}
                placeholder={isOut ? 'Logged-in inventory staff' : 'Supplier / person'}
              />
            </div>
            <div className="ui-field">
              <label>Recorded by</label>
              <input className="ui-input" value={user?.name || '—'} readOnly />
            </div>
            {!bedsActionMode ? (
              <div className="ui-field">
                <label htmlFor="used_for">{isOut ? 'Used for' : 'Received for'}</label>
                <input
                  id="used_for"
                  className="ui-input"
                  required={isOut}
                  value={moveForm.used_for}
                  onChange={(e) => setMove('used_for', e.target.value)}
                  placeholder={isOut ? 'e.g. Lunch cooking / Ward cleaning' : 'e.g. Weekly purchase'}
                />
              </div>
            ) : null}
            <div className="ui-field">
              <label htmlFor="reference">Reference</label>
              <input id="reference" className="ui-input" value={moveForm.reference} onChange={(e) => setMove('reference', e.target.value)} placeholder="Bill / PO / slip no." />
            </div>
            {(moveForm.type === 'in' || moveForm.type === 'adjust') ? (
              <div className="ui-field">
                <label htmlFor="move_bill">Bill image</label>
                <input
                  id="move_bill"
                  className="ui-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setMoveBill(e.target.files?.[0] || null)}
                />
              </div>
            ) : null}
            <div className="ui-field full">
              <label htmlFor="notes">Notes</label>
              <input id="notes" className="ui-input" value={moveForm.notes} onChange={(e) => setMove('notes', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingMove || !items.length || (bedsActionMode && selectedBed?.in_use)}>
                {savingMove ? 'Saving...' : bedsActionMode ? (moveForm.bed_action === 'discard' ? 'Discard bed' : 'Set maintenance') : 'Record movement'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Stock list</h3>
            </div>
            <div className="list-toolbar">
              <input
                className="ui-input"
                type="search"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items"
                aria-label="Search items"
              />
            </div>
            {filteredItems.length === 0 ? (
              <p className="panel-copy">No inventory items yet.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Cost</th>
                      <th>Bill</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((i) => (
                      <tr key={i.id}>
                        <td>{i.item_code}</td>
                        <td>{i.name}</td>
                        <td>{labelOf(CATEGORIES, i.category)}</td>
                        <td>
                          {i.stock_qty} {i.unit}
                          {i.low_stock ? <span className="badge badge-warn"> low</span> : null}
                        </td>
                        <td>{formatPkr(i.unit_cost)}</td>
                        <td>
                          {i.bill_image_url ? (
                            <a href={i.bill_image_url} target="_blank" rel="noreferrer">View</a>
                          ) : '—'}
                        </td>
                        <td>{i.recorded_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Stock movements</h3>
            </div>
            <div className="list-toolbar">
              <input
                className="ui-input"
                type="search"
                value={moveQuery}
                onChange={(e) => setMoveQuery(e.target.value)}
                placeholder="Search code, person, purpose"
                aria-label="Search movements"
              />
              <select className="ui-select" value={moveType} onChange={(e) => setMoveType(e.target.value)} aria-label="Type filter">
                <option value="">All types</option>
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="adjust">Adjust</option>
              </select>
              <select className="ui-select" value={movePurpose} onChange={(e) => setMovePurpose(e.target.value)} aria-label="Purpose filter">
                <option value="">All purposes</option>
                {PURPOSES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <select className="ui-select" value={moveDepartment} onChange={(e) => setMoveDepartment(e.target.value)} aria-label="Department filter">
                <option value="">All departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <select className="ui-select" value={moveStaff} onChange={(e) => setMoveStaff(e.target.value)} aria-label="Staff filter">
                <option value="">All staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {movements.length === 0 ? (
              <p className="panel-copy">No movements yet.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Purpose</th>
                      <th>Person</th>
                      <th>Dept</th>
                      <th>Used for</th>
                      <th>By</th>
                      <th>Bill</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.movement_code}</td>
                        <td>{m.item?.name}</td>
                        <td><span className="badge">{m.type}</span></td>
                        <td>{m.qty_label || `${m.quantity} ${m.unit || m.item?.unit || ''}`}</td>
                        <td>{labelOf(PURPOSES, m.purpose)}</td>
                        <td>{m.issued_to || '—'}</td>
                        <td>{labelOf(DEPARTMENTS, m.department)}</td>
                        <td>{m.used_for || '—'}</td>
                        <td>{m.recorded_by || '—'}</td>
                        <td>
                          {m.bill_image_url ? (
                            <a href={m.bill_image_url} target="_blank" rel="noreferrer">View</a>
                          ) : '—'}
                        </td>
                        <td>{m.moved_at}</td>
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
