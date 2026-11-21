import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { isWithinUploadLimit, uploadTooLargeMessage } from '../../lib/uploadLimits'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

const PURPOSES = [
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
  category_custom: '',
  unit: '',
}

const emptyMove = {
  inventory_item_id: '',
  type: 'out',
  quantity: '',
  purpose: 'kitchen_use',
  department: 'kitchen',
  notes: '',
  bed_id: '',
  bed_action: 'maintenance',
}

function labelOf(list, value) {
  return list.find((item) => item.value === value)?.label || value || '—'
}

function isCountUnit(unit) {
  return /^(pc|pcs|piece|pieces|unit|units|count)$/i.test(String(unit || '').trim())
}

function localDateValue() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function InventoryDropdown({ id, value, options, onChange, placeholder, disabled = false }) {
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [maxHeight, setMaxHeight] = useState(280)
  const selectedOption = options.find((option) => String(option.value) === String(value))

  useEffect(() => {
    if (!open) return undefined

    function updateMaxHeight() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMaxHeight(Math.max(100, Math.min(280, window.innerHeight - rect.bottom - 12)))
    }

    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    updateMaxHeight()
    document.addEventListener('mousedown', closeOutside)
    window.addEventListener('resize', updateMaxHeight)
    window.addEventListener('scroll', updateMaxHeight, true)

    return () => {
      document.removeEventListener('mousedown', closeOutside)
      window.removeEventListener('resize', updateMaxHeight)
      window.removeEventListener('scroll', updateMaxHeight, true)
    }
  }, [open])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }

    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect && window.innerHeight - rect.bottom < 180) {
      triggerRef.current.scrollIntoView({ block: 'center', behavior: 'auto' })
    }
    setOpen(true)
  }

  function handleOptionKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const optionButtons = Array.from(
      rootRef.current?.querySelectorAll('.inventory-dropdown-option:not(:disabled)') || []
    )
    if (!optionButtons.length) return

    const currentIndex = optionButtons.indexOf(document.activeElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? optionButtons.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + optionButtons.length) % optionButtons.length
    optionButtons[nextIndex]?.focus()
  }

  return (
    <div className={`inventory-dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="ui-select inventory-dropdown-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-required="true"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              toggle()
              return
            }
            rootRef.current?.querySelector('.inventory-dropdown-option:not(:disabled)')?.focus()
          }
        }}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={`${id}-options`}
          className="inventory-dropdown-options"
          role="listbox"
          style={{ maxHeight }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="inventory-dropdown-option"
              role="option"
              aria-selected={String(option.value) === String(value)}
              disabled={option.disabled}
              onKeyDown={handleOptionKeyDown}
              onClick={() => {
                onChange(String(option.value))
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const canUseInventory = (user?.modules || []).includes('inventory')
  const requestedTab = searchParams.get('tab') || 'use'
  const activeTab = ['use', 'receive', 'levels'].includes(requestedTab) ? requestedTab : 'use'
  const canViewStockAlerts = ['admin', 'inventory-manager'].includes(user?.role_slug)
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingMove, setSavingMove] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState(CATEGORIES)
  const [itemForm, setItemForm] = useState(emptyItem)
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [moveForm, setMoveForm] = useState(emptyMove)
  const [itemSearch, setItemSearch] = useState('')
  const [stockBill, setStockBill] = useState(null)
  const stockBillInputRef = useRef(null)
  const [beds, setBeds] = useState([])
  const [stockForm, setStockForm] = useState({
    inventory_item_id: '',
    quantity: '',
    supplier: '',
    unit_cost: '',
    received_at: localDateValue(),
    notes: '',
  })

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === String(moveForm.inventory_item_id)),
    [items, moveForm.inventory_item_id]
  )
  const selectedStockItem = useMemo(
    () => items.find((item) => String(item.id) === String(stockForm.inventory_item_id)),
    [items, stockForm.inventory_item_id]
  )
  const selectedBed = useMemo(
    () => beds.find((bed) => String(bed.id) === String(moveForm.bed_id)),
    [beds, moveForm.bed_id]
  )
  const isBedsItem = selectedItem?.category === 'beds'
  const bedsActionMode = isBedsItem
  const quantityStep = isCountUnit(selectedItem?.unit) ? '1' : '0.01'
  const stockOutError = selectedItem && (
    Number(selectedItem.stock_qty) <= 0
      ? `${selectedItem.name} is out of stock.`
      : Number(moveForm.quantity) > Number(selectedItem.stock_qty)
        ? `Insufficient stock. Available: ${selectedItem.stock_qty} ${selectedItem.unit}.`
        : ''
  )

  function setItem(key, value) {
    setItemForm((previous) => ({ ...previous, [key]: value }))
  }

  function setMove(key, value) {
    setMoveForm((previous) => ({ ...previous, [key]: value }))
  }

  function clearStockBill() {
    setStockBill(null)
    if (stockBillInputRef.current) stockBillInputRef.current.value = ''
  }

  async function loadItems() {
    const firstPage = await api('/inventory-items?status=active&per_page=100&page=1')
    const pageCount = Number(firstPage.meta?.last_page || 1)
    const otherPages = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
        api(`/inventory-items?status=active&per_page=100&page=${index + 2}`)
      )
    )
    setItems([...(firstPage.data || []), ...otherPages.flatMap((page) => page.data || [])])
    if (Array.isArray(firstPage.meta?.categories) && firstPage.meta.categories.length) {
      setCategories(firstPage.meta.categories)
    }
  }

  async function loadBeds() {
    const response = await api('/inventory-beds')
    setBeds(response.data || [])
  }

  useEffect(() => {
    if (!canUseInventory) return

    Promise.all([loadItems(), loadBeds()])
      .catch((error) => toast.error(error.message || 'Failed to load inventory'))
      .finally(() => setLoading(false))
  }, [canUseInventory])

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) =>
      [item.name, item.item_code, item.category].some((value) =>
        String(value || '').toLowerCase().includes(query)
      )
    )
  }, [items, itemSearch])

  if (!canUseInventory) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  async function handleAddItem(event) {
    event.preventDefault()
    setSavingItem(true)
    try {
      const category = itemForm.category === '__new__'
        ? itemForm.category_custom.trim()
        : itemForm.category
      if (!category) {
        toast.error('Category is required')
        return
      }
      if (!itemForm.unit.trim()) {
        toast.error('Unit is required')
        return
      }

      const body = new FormData()
      body.append('name', itemForm.name)
      body.append('category', category)
      body.append('unit', itemForm.unit.trim())

      const response = await api('/inventory-items', { method: 'POST', body })
      toast.success(response.message || `${response.data.item_code} added`)
      setItemForm(emptyItem)
      setShowNewItemModal(false)
      clearStockBill()
      setStockForm((previous) => ({
        ...previous,
        inventory_item_id: String(response.data.id),
        quantity: '',
        supplier: '',
        unit_cost: '',
        received_at: localDateValue(),
        notes: '',
      }))
      await Promise.all([loadItems(), loadBeds()])
    } catch (error) {
      toast.error(error.message || 'Failed to add item')
    } finally {
      setSavingItem(false)
    }
  }

  async function handleUseStock(event) {
    event.preventDefault()
    if (!selectedItem || Number(selectedItem.stock_qty) <= 0) {
      toast.error(selectedItem ? `${selectedItem.name} is out of stock.` : 'Select an item')
      return
    }
    if (!isBedsItem && Number(moveForm.quantity) > Number(selectedItem.stock_qty)) {
      toast.error(`Insufficient stock. Available: ${selectedItem.stock_qty} ${selectedItem.unit}.`)
      return
    }
    if (isBedsItem && !moveForm.bed_id) {
      toast.error('Select a bed')
      return
    }
    if (isBedsItem && selectedBed?.in_use) {
      toast.error('Bed is in use. Discharge the patient first.')
      return
    }

    setSavingMove(true)
    try {
      const body = new FormData()
      body.append('inventory_item_id', String(selectedItem.id))
      body.append('type', 'out')
      if (isBedsItem) {
        body.append('bed_id', String(Number(moveForm.bed_id)))
        body.append('bed_action', moveForm.bed_action)
        body.append('quantity', '1')
        body.append('purpose', moveForm.bed_action === 'discard' ? 'waste' : 'maintenance')
        body.append('department', 'maintenance')
      } else {
        body.append('quantity', String(Number(moveForm.quantity)))
        body.append('purpose', moveForm.purpose)
        body.append('department', moveForm.department)
      }
      if (moveForm.notes.trim()) body.append('notes', moveForm.notes.trim())

      const response = await api('/inventory-movements', { method: 'POST', body })
      toast.success(response.message || `${response.data.movement_code} recorded`)
      setMoveForm(emptyMove)
      await Promise.all([loadItems(), loadBeds()])
    } catch (error) {
      toast.error(error.message || 'Stock use failed')
    } finally {
      setSavingMove(false)
    }
  }

  async function handleReceiveStock(event) {
    event.preventDefault()
    if (!selectedStockItem) {
      toast.error('Select an item')
      return
    }

    setSavingStock(true)
    try {
      const body = new FormData()
      body.append('inventory_item_id', String(selectedStockItem.id))
      body.append('type', 'in')
      body.append('quantity', String(Number(stockForm.quantity)))
      body.append('purpose', 'purchase')
      body.append('supplier', stockForm.supplier.trim())
      body.append('unit_cost', String(Number(stockForm.unit_cost)))
      if (stockForm.received_at) body.append('moved_at', `${stockForm.received_at} 12:00:00`)
      if (stockForm.notes.trim()) body.append('notes', stockForm.notes.trim())
      if (stockBill) body.append('bill_image', stockBill)

      const response = await api('/inventory-movements', { method: 'POST', body })
      toast.success(response.message || `${response.data.movement_code} received`)
      setStockForm({
        inventory_item_id: '',
        quantity: '',
        supplier: '',
        unit_cost: '',
        received_at: localDateValue(),
        notes: '',
      })
      clearStockBill()
      await Promise.all([loadItems(), loadBeds()])
    } catch (error) {
      toast.error(error.message || 'Failed to receive stock')
    } finally {
      setSavingStock(false)
    }
  }

  return (
    <div className="page print-page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Inventory &amp; Stock</h2>
        </div>
        {activeTab === 'receive' ? (
          <div className="page-actions no-print">
            <Button type="button" variant="secondary" onClick={() => setShowNewItemModal(true)}>
              Add new item
            </Button>
          </div>
        ) : activeTab === 'levels' && canViewStockAlerts ? (
          <div className="page-actions">
            <Button type="button" variant="secondary" onClick={() => window.print()} disabled={loading}>
              Print
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          {activeTab === 'receive' ? (
            <>
              <form className="panel form-grid no-print" onSubmit={handleReceiveStock}>
                <div className="panel-head full">
                  <h3>Receive stock</h3>
                </div>
                <div className="ui-field">
                  <label htmlFor="receive_item">Item</label>
                  <InventoryDropdown
                    id="receive_item"
                    value={stockForm.inventory_item_id}
                    placeholder="Select an existing item"
                    options={items.map((item) => ({
                      value: item.id,
                      label: `${item.name} · ${item.stock_qty} ${item.unit}`,
                    }))}
                    onChange={(value) => {
                      const item = items.find((row) => String(row.id) === value)
                      setStockForm((previous) => ({
                        ...previous,
                        inventory_item_id: value,
                        quantity: '',
                        unit_cost: '',
                        supplier: item?.supplier || '',
                        notes: '',
                      }))
                      clearStockBill()
                    }}
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="receive_qty">Quantity ({selectedStockItem?.unit || 'unit'})</label>
                  <input id="receive_qty" className="ui-input" type="number" min="0.01" step={isCountUnit(selectedStockItem?.unit) ? '1' : '0.01'} required value={stockForm.quantity} onChange={(event) => setStockForm((previous) => ({ ...previous, quantity: event.target.value }))} />
                </div>
                <div className="ui-field">
                  <label htmlFor="receive_cost">Purchase price per {selectedStockItem?.unit || 'unit'} (PKR)</label>
                  <input id="receive_cost" className="ui-input" type="number" min="0" step="0.01" required value={stockForm.unit_cost} onChange={(event) => setStockForm((previous) => ({ ...previous, unit_cost: event.target.value }))} />
                </div>
                <div className="ui-field">
                  <label htmlFor="receive_supplier">Supplier / received from</label>
                  <input id="receive_supplier" className="ui-input" value={stockForm.supplier} onChange={(event) => setStockForm((previous) => ({ ...previous, supplier: event.target.value }))} />
                </div>
                <div className="ui-field">
                  <label htmlFor="receive_date">Received date</label>
                  <input id="receive_date" className="ui-input" type="date" required value={stockForm.received_at} onChange={(event) => setStockForm((previous) => ({ ...previous, received_at: event.target.value }))} />
                </div>
                <div className="ui-field">
                  <label htmlFor="receive_bill">Bill / receipt</label>
                  <input
                    id="receive_bill"
                    ref={stockBillInputRef}
                    className="ui-input"
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      if (file && !isWithinUploadLimit(file)) {
                        toast.error(uploadTooLargeMessage('Bill image'))
                        event.target.value = ''
                        setStockBill(null)
                        return
                      }
                      setStockBill(file)
                    }}
                  />
                </div>
                <div className="ui-field full">
                  <label htmlFor="receive_notes">Notes</label>
                  <input id="receive_notes" className="ui-input" value={stockForm.notes} onChange={(event) => setStockForm((previous) => ({ ...previous, notes: event.target.value }))} />
                </div>
                <div className="form-actions full">
                  <Button type="submit" disabled={savingStock || !items.length}>{savingStock ? 'Saving…' : 'Receive stock'}</Button>
                </div>
              </form>
            </>
          ) : null}

          {activeTab === 'use' ? (
            <form className="panel form-grid no-print" onSubmit={handleUseStock}>
              <div className="panel-head full"><h3>{isBedsItem ? 'Bed maintenance / discard' : 'Use stock'}</h3></div>
              <div className="ui-field">
                <label htmlFor="use_item">Item</label>
                <InventoryDropdown
                  id="use_item"
                  value={moveForm.inventory_item_id}
                  placeholder="Select item"
                  options={items.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.stock_qty} ${item.unit}`,
                  }))}
                  onChange={(value) => {
                    const item = items.find((row) => String(row.id) === value)
                    setMoveForm({
                      ...emptyMove,
                      inventory_item_id: value,
                      purpose: item?.category === 'beds' ? 'maintenance' : 'kitchen_use',
                      department: item?.category === 'beds' ? 'maintenance' : 'kitchen',
                    })
                    if (item && Number(item.stock_qty) <= 0) toast.error(`${item.name} is out of stock.`)
                  }}
                />
              </div>
              {bedsActionMode ? (
                <>
                  <div className="ui-field">
                    <label htmlFor="use_bed">Bed</label>
                    <InventoryDropdown
                      id="use_bed"
                      value={moveForm.bed_id}
                      placeholder="Select bed"
                      options={beds.map((bed) => ({
                        value: bed.id,
                        label: bed.label,
                        disabled: bed.in_use,
                      }))}
                      onChange={(value) => setMove('bed_id', value)}
                    />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="bed_action">Action</label>
                    <InventoryDropdown
                      id="bed_action"
                      value={moveForm.bed_action}
                      options={[
                        { value: 'maintenance', label: 'Maintenance' },
                        { value: 'discard', label: 'Total discard' },
                      ]}
                      onChange={(value) => setMove('bed_action', value)}
                    />
                  </div>
                </>
              ) : (
                <div className="ui-field">
                  <label htmlFor="use_quantity">Quantity ({selectedItem?.unit || 'unit'})</label>
                  <input id="use_quantity" className="ui-input" type="number" min={quantityStep} max={selectedItem?.stock_qty} step={quantityStep} required value={moveForm.quantity} onChange={(event) => setMove('quantity', event.target.value)} />
                  {stockOutError ? <span className="inventory-stock-error">{stockOutError}</span> : null}
                </div>
              )}
              {!bedsActionMode ? (
                <>
                  <div className="ui-field">
                    <label htmlFor="use_purpose">Purpose</label>
                    <InventoryDropdown
                      id="use_purpose"
                      value={moveForm.purpose}
                      options={PURPOSES}
                      onChange={(value) => setMove('purpose', value)}
                    />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="use_department">Department</label>
                    <InventoryDropdown
                      id="use_department"
                      value={moveForm.department}
                      options={DEPARTMENTS}
                      onChange={(value) => setMove('department', value)}
                    />
                  </div>
                </>
              ) : null}
              <div className="ui-field full">
                <label htmlFor="use_notes">Notes</label>
                <input id="use_notes" className="ui-input" value={moveForm.notes} onChange={(event) => setMove('notes', event.target.value)} />
              </div>
              <div className="form-actions full">
                <Button type="submit" disabled={savingMove || !selectedItem || !!stockOutError || (bedsActionMode && selectedBed?.in_use)}>
                  {savingMove ? 'Saving…' : bedsActionMode ? (moveForm.bed_action === 'discard' ? 'Discard bed' : 'Set maintenance') : 'Record use'}
                </Button>
              </div>
            </form>
          ) : null}

          {activeTab === 'levels' ? (
            <section className="panel print-stock-panel">
              <div className="panel-head"><h3>All items</h3></div>
              <div className="list-toolbar no-print">
                <input className="ui-input" type="search" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search items" aria-label="Search items" />
              </div>
              {filteredItems.length === 0 ? (
                <p className="panel-copy">No inventory items found.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel print-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Current stock</th>
                        {canViewStockAlerts ? <><th>Low stock limit</th><th>Status</th></> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}<br /><small>{item.item_code}</small></td>
                          <td>{item.category_label || labelOf(categories, item.category)}</td>
                          <td>
                            <span className={`inventory-stock-level${item.stock_status === 'Out of stock' ? ' is-out' : item.stock_status === 'Low stock' ? ' is-low' : ''}`}>
                              {item.stock_qty} {item.unit}
                            </span>
                          </td>
                          {canViewStockAlerts ? (
                            <>
                              <td>{item.track_reorder ? `${item.reorder_level} ${item.unit}` : '—'}</td>
                              <td>
                                <span className={`badge ${item.stock_status === 'Out of stock' ? 'badge-danger' : item.stock_status === 'Low stock' ? 'badge-warn' : 'badge-ok'}`}>
                                  {item.stock_status || 'In stock'}
                                </span>
                              </td>
                            </>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
      <Modal
        open={showNewItemModal}
        title="Add a new inventory item"
        onClose={() => setShowNewItemModal(false)}
        hideFooter
      >
        <form className="form-grid" onSubmit={handleAddItem}>
          <div className="ui-field full">
            <label htmlFor="new_item_name">Name</label>
            <input id="new_item_name" className="ui-input" required value={itemForm.name} onChange={(event) => setItem('name', event.target.value)} />
          </div>
          <div className="ui-field">
            <label htmlFor="new_item_category">Category</label>
            <select
              id="new_item_category"
              className="ui-select"
              value={itemForm.category}
              onChange={(event) => {
                const category = event.target.value
                setItemForm((previous) => ({ ...previous, category }))
              }}
            >
              {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              <option value="__new__">Add new…</option>
            </select>
          </div>
          {itemForm.category === '__new__' ? (
            <div className="ui-field">
              <label htmlFor="new_item_category_custom">New category</label>
              <input id="new_item_category_custom" className="ui-input" required value={itemForm.category_custom} onChange={(event) => setItem('category_custom', event.target.value)} />
            </div>
          ) : null}
          <div className="ui-field">
            <label htmlFor="new_item_unit">Unit</label>
            <input
              id="new_item_unit"
              className="ui-input"
              required
              value={itemForm.unit}
              onChange={(event) => setItem('unit', event.target.value)}
              placeholder="e.g. pcs, kg, liter"
            />
          </div>
          <div className="form-actions full">
            <Button type="button" variant="ghost" onClick={() => setShowNewItemModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingItem}>
              {savingItem ? 'Adding…' : 'Add item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
