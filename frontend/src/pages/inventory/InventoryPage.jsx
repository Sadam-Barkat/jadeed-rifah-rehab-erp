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
import DateRangeFilter, { defaultRange } from '../../components/dashboard/DateRangeFilter'
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

const DISCARD_CATEGORIES = [
  { value: 'beds', label: 'Beds' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'security', label: 'Security / cameras' },
  { value: 'linen', label: 'Linen' },
]

const emptyDiscard = {
  category: 'beds',
  inventory_item_id: '',
  bed_id: '',
  quantity: '',
  notes: '',
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

function formatMovedAt(value) {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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
  const isCook = user?.role_slug === 'cook'
  const isInventoryManager = user?.role_slug === 'inventory-manager'
  const requestedTab = searchParams.get('tab') || 'use'
  const allowedTabs = isCook ? ['use'] : ['use', 'receive', 'levels', 'discard']
  const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : 'use'
  const canViewStockAlerts = ['admin', 'inventory-manager'].includes(user?.role_slug)
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingMove, setSavingMove] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [savingDiscard, setSavingDiscard] = useState(false)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState(CATEGORIES)
  const [itemForm, setItemForm] = useState(emptyItem)
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [blockDiscardOpen, setBlockDiscardOpen] = useState(false)
  const [moveForm, setMoveForm] = useState(emptyMove)
  const [discardForm, setDiscardForm] = useState(emptyDiscard)
  const [itemSearch, setItemSearch] = useState('')
  const [stockBill, setStockBill] = useState(null)
  const stockBillInputRef = useRef(null)
  const [beds, setBeds] = useState([])
  const [cookMoves, setCookMoves] = useState([])
  const [cooks, setCooks] = useState([])
  const [cookLogLoading, setCookLogLoading] = useState(false)
  const [cookSearch, setCookSearch] = useState('')
  const [debouncedCookSearch, setDebouncedCookSearch] = useState('')
  const [cookFilter, setCookFilter] = useState(() => defaultRange())
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
  const discardItems = useMemo(
    () => items.filter((item) => item.category === discardForm.category),
    [items, discardForm.category]
  )
  const bedsInventoryItem = useMemo(
    () => items.find((item) => item.category === 'beds') || null,
    [items]
  )
  const selectedDiscardItem = useMemo(
    () => items.find((item) => String(item.id) === String(discardForm.inventory_item_id)),
    [items, discardForm.inventory_item_id]
  )
  const selectedDiscardBed = useMemo(
    () => beds.find((bed) => String(bed.id) === String(discardForm.bed_id)),
    [beds, discardForm.bed_id]
  )
  const isDiscardBeds = discardForm.category === 'beds'
  const discardListLabel = isDiscardBeds
    ? 'Bed'
    : (DISCARD_CATEGORIES.find((row) => row.value === discardForm.category)?.label || 'Item')
  const quantityStep = isCountUnit(selectedItem?.unit) ? '1' : '0.01'
  const discardQtyStep = isCountUnit(selectedDiscardItem?.unit) ? '1' : '0.01'
  const stockOutError = selectedItem && (
    Number(selectedItem.stock_qty) <= 0
      ? `${selectedItem.name} is out of stock.`
      : Number(moveForm.quantity) > Number(selectedItem.stock_qty)
        ? `Insufficient stock. Available: ${selectedItem.stock_qty} ${selectedItem.unit}.`
        : ''
  )
  const useItems = useMemo(
    () => (isCook ? items : items.filter((item) => item.category !== 'beds')),
    [items, isCook]
  )

  function setItem(key, value) {
    setItemForm((previous) => ({ ...previous, [key]: value }))
  }

  function setMove(key, value) {
    setMoveForm((previous) => ({ ...previous, [key]: value }))
  }

  function setDiscard(key, value) {
    setDiscardForm((previous) => ({ ...previous, [key]: value }))
  }

  function clearStockBill() {
    setStockBill(null)
    if (stockBillInputRef.current) stockBillInputRef.current.value = ''
  }

  async function loadItems() {
    const categoryQuery = isCook ? '&category=kitchen' : ''
    const firstPage = await api(`/inventory-items?status=active&per_page=100&page=1${categoryQuery}`)
    const pageCount = Number(firstPage.meta?.last_page || 1)
    const otherPages = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
        api(`/inventory-items?status=active&per_page=100&page=${index + 2}${categoryQuery}`)
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

  async function loadCookLog() {
    if (!isCook) return
    setCookLogLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'out',
        purpose: 'kitchen_use',
        department: 'kitchen',
        per_page: '100',
        page: '1',
      })
      if (cookFilter?.from) params.set('from', cookFilter.from)
      if (cookFilter?.to) params.set('to', cookFilter.to)
      if (cookFilter?.created_by) params.set('created_by', String(cookFilter.created_by))
      if (debouncedCookSearch) params.set('q', debouncedCookSearch)

      const firstPage = await api(`/inventory-movements?${params}`)
      const pageCount = Number(firstPage.meta?.last_page || 1)
      const otherPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => {
          const next = new URLSearchParams(params)
          next.set('page', String(index + 2))
          return api(`/inventory-movements?${next}`)
        })
      )
      setCookMoves([...(firstPage.data || []), ...otherPages.flatMap((page) => page.data || [])])
      if (Array.isArray(firstPage.meta?.cooks)) {
        setCooks(firstPage.meta.cooks)
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load kitchen use log')
    } finally {
      setCookLogLoading(false)
    }
  }

  useEffect(() => {
    if (!canUseInventory) return

    Promise.all([loadItems(), isCook ? Promise.resolve() : loadBeds()])
      .catch((error) => toast.error(error.message || 'Failed to load inventory'))
      .finally(() => setLoading(false))
  }, [canUseInventory, isCook])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCookSearch(cookSearch.trim()), 350)
    return () => clearTimeout(timer)
  }, [cookSearch])

  useEffect(() => {
    if (!isCook || !canUseInventory || loading) return
    loadCookLog()
  }, [isCook, canUseInventory, loading, debouncedCookSearch, cookFilter?.from, cookFilter?.to, cookFilter?.created_by, cookFilter?.mode])

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
    if (Number(moveForm.quantity) > Number(selectedItem.stock_qty)) {
      toast.error(`Insufficient stock. Available: ${selectedItem.stock_qty} ${selectedItem.unit}.`)
      return
    }

    setSavingMove(true)
    try {
      const body = new FormData()
      body.append('inventory_item_id', String(selectedItem.id))
      body.append('type', 'out')
      body.append('quantity', String(Number(moveForm.quantity)))
      body.append('purpose', isCook ? 'kitchen_use' : moveForm.purpose)
      body.append('department', isCook ? 'kitchen' : moveForm.department)
      if (moveForm.notes.trim()) body.append('notes', moveForm.notes.trim())

      const response = await api('/inventory-movements', { method: 'POST', body })
      toast.success(response.message || `${response.data.movement_code} recorded`)
      setMoveForm(emptyMove)
      await Promise.all([
        loadItems(),
        isCook ? loadCookLog() : loadBeds(),
      ])
    } catch (error) {
      toast.error(error.message || 'Stock use failed')
    } finally {
      setSavingMove(false)
    }
  }

  async function handleDiscard(event) {
    event.preventDefault()
    if (isDiscardBeds) {
      if (!bedsInventoryItem) {
        toast.error('No beds stock item found')
        return
      }
      if (!discardForm.bed_id) {
        toast.error('Select a bed')
        return
      }
      if (selectedDiscardBed?.in_use) {
        setBlockDiscardOpen(true)
        return
      }
    } else {
      if (!selectedDiscardItem) {
        toast.error('Select an item')
        return
      }
      if (!discardForm.quantity || Number(discardForm.quantity) <= 0) {
        toast.error('Enter quantity')
        return
      }
      if (Number(discardForm.quantity) > Number(selectedDiscardItem.stock_qty)) {
        toast.error(`Insufficient stock. Available: ${selectedDiscardItem.stock_qty} ${selectedDiscardItem.unit}.`)
        return
      }
    }

    const targetItem = isDiscardBeds ? bedsInventoryItem : selectedDiscardItem
    setSavingDiscard(true)
    try {
      const body = new FormData()
      body.append('inventory_item_id', String(targetItem.id))
      body.append('type', 'out')
      body.append('purpose', 'waste')
      body.append('department', 'maintenance')
      if (isDiscardBeds) {
        body.append('bed_id', String(Number(discardForm.bed_id)))
        body.append('bed_action', 'discard')
        body.append('quantity', '1')
      } else {
        body.append('quantity', String(Number(discardForm.quantity)))
      }
      if (discardForm.notes.trim()) body.append('notes', discardForm.notes.trim())

      const response = await api('/inventory-movements', { method: 'POST', body })
      toast.success(response.message || `${response.data.movement_code} discarded`)
      setDiscardForm((previous) => ({
        ...emptyDiscard,
        category: previous.category,
      }))
      await Promise.all([loadItems(), loadBeds()])
    } catch (error) {
      const message = error.message || 'Discard failed'
      if (/not possible|assigned to a patient|in use/i.test(message)) {
        setBlockDiscardOpen(true)
      } else {
        toast.error(message)
      }
    } finally {
      setSavingDiscard(false)
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
          <h2>{isCook ? 'Kitchen stock' : 'Inventory & Stock'}</h2>
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
              <div className="panel-head full"><h3>{isCook ? 'Kitchen stock use' : 'Use stock'}</h3></div>
              <div className="ui-field">
                <label htmlFor="use_item">Item</label>
                <InventoryDropdown
                  id="use_item"
                  value={moveForm.inventory_item_id}
                  placeholder="Select item"
                  options={useItems.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.stock_qty} ${item.unit}`,
                  }))}
                  onChange={(value) => {
                    const item = useItems.find((row) => String(row.id) === value)
                    setMoveForm({
                      ...emptyMove,
                      inventory_item_id: value,
                      purpose: 'kitchen_use',
                      department: 'kitchen',
                    })
                    if (item && Number(item.stock_qty) <= 0) toast.error(`${item.name} is out of stock.`)
                  }}
                />
              </div>
              <div className="ui-field">
                <label htmlFor="use_quantity">Quantity ({selectedItem?.unit || 'unit'})</label>
                <input id="use_quantity" className="ui-input" type="number" min={quantityStep} max={selectedItem?.stock_qty} step={quantityStep} required value={moveForm.quantity} onChange={(event) => setMove('quantity', event.target.value)} />
                {stockOutError ? <span className="inventory-stock-error">{stockOutError}</span> : null}
              </div>
              {!isCook ? (
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
                <Button type="submit" disabled={savingMove || !selectedItem || !!stockOutError}>
                  {savingMove ? 'Saving…' : 'Record use'}
                </Button>
              </div>
            </form>
          ) : null}

          {isCook && activeTab === 'use' ? (
            <section className="panel print-stock-panel">
              <header className="print-dash-head">
                <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
                <h3>Kitchen use log</h3>
              </header>
              <div className="panel-head no-print">
                <h3>Kitchen use log</h3>
              </div>
              <div className="list-toolbar no-print kitchen-log-toolbar">
                <input
                  className="ui-input kitchen-log-search"
                  type="search"
                  value={cookSearch}
                  onChange={(event) => setCookSearch(event.target.value)}
                  placeholder="Search item or cook"
                  aria-label="Search kitchen use log"
                />
                <div className="kitchen-log-filter-row">
                  <DateRangeFilter
                    value={cookFilter}
                    onApply={setCookFilter}
                    loading={cookLogLoading}
                    showStaff
                    staffOptions={cooks}
                    staffLabel="Cook"
                  />
                  <div className="date-filter-field date-filter-action-field kitchen-log-print-field">
                    <span>&nbsp;</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="kitchen-log-print-btn"
                      onClick={() => window.print()}
                      disabled={loading || cookLogLoading}
                    >
                      Print
                    </Button>
                  </div>
                </div>
              </div>
              {cookLogLoading ? (
                <SkeletonCards count={2} />
              ) : cookMoves.length === 0 ? (
                <p className="panel-copy">No kitchen use records for this filter.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel print-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date / time</th>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Cook</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cookMoves.map((row) => (
                        <tr key={row.id}>
                          <td>{formatMovedAt(row.moved_at)}</td>
                          <td>
                            {row.item?.name || '—'}
                            {row.item?.item_code ? (
                              <>
                                <br />
                                <small>{row.item.item_code}</small>
                              </>
                            ) : null}
                          </td>
                          <td>{row.qty_label || `${row.quantity} ${row.unit}`}</td>
                          <td>{row.recorded_by || row.issued_to || '—'}</td>
                          <td>{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'discard' && isInventoryManager ? (
            <form className="panel form-grid no-print" onSubmit={handleDiscard}>
              <div className="panel-head full"><h3>Discard item</h3></div>
              <div className="ui-field">
                <label htmlFor="discard_category">Category</label>
                <InventoryDropdown
                  id="discard_category"
                  value={discardForm.category}
                  options={DISCARD_CATEGORIES}
                  onChange={(value) => setDiscardForm({
                    ...emptyDiscard,
                    category: value,
                  })}
                />
              </div>
              {isDiscardBeds ? (
                <div className="ui-field">
                  <label htmlFor="discard_bed">{discardListLabel}</label>
                  <InventoryDropdown
                    id="discard_bed"
                    value={discardForm.bed_id}
                    placeholder="Select bed"
                    options={beds.map((bed) => ({
                      value: bed.id,
                      label: bed.label,
                    }))}
                    onChange={(value) => {
                      const bed = beds.find((row) => String(row.id) === String(value))
                      if (bed?.in_use) {
                        setBlockDiscardOpen(true)
                        return
                      }
                      setDiscard('bed_id', value)
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="ui-field">
                    <label htmlFor="discard_list">{discardListLabel}</label>
                    <InventoryDropdown
                      id="discard_list"
                      value={discardForm.inventory_item_id}
                      placeholder={`Select ${discardListLabel.toLowerCase()}`}
                      options={discardItems.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${item.stock_qty} ${item.unit}`,
                      }))}
                      onChange={(value) => setDiscardForm((previous) => ({
                        ...previous,
                        inventory_item_id: value,
                        quantity: '',
                      }))}
                    />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="discard_qty">Quantity ({selectedDiscardItem?.unit || 'unit'})</label>
                    <input
                      id="discard_qty"
                      className="ui-input"
                      type="number"
                      min={discardQtyStep}
                      max={selectedDiscardItem?.stock_qty}
                      step={discardQtyStep}
                      required
                      value={discardForm.quantity}
                      onChange={(event) => setDiscard('quantity', event.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="ui-field full">
                <label htmlFor="discard_notes">Notes</label>
                <input id="discard_notes" className="ui-input" value={discardForm.notes} onChange={(event) => setDiscard('notes', event.target.value)} />
              </div>
              <div className="form-actions full">
                <Button
                  type="submit"
                  disabled={
                    savingDiscard
                    || (isDiscardBeds
                      ? !bedsInventoryItem || !discardForm.bed_id || selectedDiscardBed?.in_use
                      : !selectedDiscardItem || !discardForm.quantity)
                  }
                >
                  {savingDiscard ? 'Saving…' : 'Discard'}
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
        open={blockDiscardOpen}
        title="Not possible"
        onClose={() => setBlockDiscardOpen(false)}
        cancelLabel="OK"
        confirm={false}
        size="sm"
      >
        <p className="panel-copy">This bed is assigned to a patient. Discharge the patient first.</p>
      </Modal>
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
