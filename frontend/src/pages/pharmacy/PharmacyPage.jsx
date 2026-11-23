import { Fragment, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { clearDraft, hasFulfillDraft, listFulfillDrafts, loadDraft, saveDraft } from '../../lib/pharmacyDrafts'
import { isWithinUploadLimit, uploadTooLargeMessage } from '../../lib/uploadLimits'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ScrollSelect from '../../components/ui/ScrollSelect'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

const RECEIVE_DRAFT_KEY = 'receive_stock'
const RECEIVE_OPTS_KEY = 'receive_field_options'

function emptyReceiveOptions() {
  return {
    generic_name: [],
    strength: [],
    batch_no: [],
    supplier: [],
    manufacturer: [],
    category: [],
  }
}

function loadReceiveOptions() {
  const saved = loadDraft(RECEIVE_OPTS_KEY)
  return { ...emptyReceiveOptions(), ...(saved || {}) }
}

function rememberReceiveOptions(lines) {
  const extra = loadReceiveOptions()
  const keys = ['generic_name', 'strength', 'batch_no', 'supplier', 'manufacturer']
  for (const line of lines) {
    for (const key of keys) {
      const value = String(line[key] || '').trim()
      if (!value) continue
      if (!extra[key].some((item) => item.toLowerCase() === value.toLowerCase())) {
        extra[key].push(value)
      }
    }
    const category = line.category === '__new__'
      ? String(line.category_custom || '').trim()
      : String(line.category || '').trim()
    if (category && !extra.category.some((item) => item.toLowerCase() === category.toLowerCase())) {
      extra.category.push(category)
    }
  }
  saveDraft(RECEIVE_OPTS_KEY, extra)
  return extra
}

function uniqueSelectOptions(...lists) {
  const seen = new Set()
  const options = []
  for (const list of lists) {
    for (const raw of list || []) {
      const value = String(raw || '').trim()
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      options.push({ value, label: value })
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

function appendReceiveOption(prev, field, value) {
  const nextValue = String(value || '').trim()
  if (!nextValue) return prev
  const list = prev[field] || []
  if (list.some((item) => String(item).toLowerCase() === nextValue.toLowerCase())) return prev
  return { ...prev, [field]: [...list, nextValue] }
}

function emptyReceiveLine() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicine_id: '',
    name: '',
    generic_name: '',
    category: 'analgesics',
    category_custom: '',
    form: 'tablet',
    strength: '',
    unit: 'tablet',
    manufacturer: '',
    stock_qty: '',
    reorder_level: '20',
    unit_price: '',
    batch_no: '',
    expiry_date: new Date().toISOString().slice(0, 10),
    supplier: '',
    notes: '',
  }
}

function buildStockCategories(list, categoryOptions) {
  const byCat = new Map()
  for (const m of list) {
    const key = m.category || 'other'
    if (!byCat.has(key)) byCat.set(key, [])
    byCat.get(key).push(m)
  }

  const ordered = []
  const seen = new Set()
  for (const cat of categoryOptions) {
    seen.add(cat.value)
    const items = byCat.get(cat.value) || []
    ordered.push({
      key: cat.value,
      label: cat.label,
      items,
      lowCount: items.filter((m) => m.low_stock).length,
      totalQty: items.reduce((sum, m) => sum + Number(m.stock_qty || 0), 0),
    })
  }
  for (const [key, items] of byCat.entries()) {
    if (seen.has(key)) continue
    ordered.push({
      key,
      label: items[0]?.category_label || key,
      items,
      lowCount: items.filter((m) => m.low_stock).length,
      totalQty: items.reduce((sum, m) => sum + Number(m.stock_qty || 0), 0),
    })
  }

  const allItems = list
  return [
    {
      key: 'all',
      label: 'All',
      items: allItems,
      lowCount: allItems.filter((m) => m.low_stock).length,
      totalQty: allItems.reduce((sum, m) => sum + Number(m.stock_qty || 0), 0),
    },
    ...ordered,
  ]
}

const FORMS = [
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

const UNITS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'ml', label: 'ml' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'strip', label: 'Strip' },
  { value: 'box', label: 'Box' },
  { value: 'vial', label: 'Vial' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'tube', label: 'Tube' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'unit', label: 'Unit' },
]

const DEFAULT_MED_CATEGORIES = [
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

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'all', label: 'All' },
]

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function formatWhen(value) {
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

function doctorName(rx) {
  return rx?.doctor?.full_name || rx?.prescribed_by || '—'
}

function doctorSpecialty(rx) {
  return rx?.doctor?.specialization || rx?.doctor_specialization || '—'
}

export default function PharmacyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canUsePharmacy = (user?.modules || []).includes('pharmacy')
  const requestedTab = searchParams.get('tab') || 'prescriptions'
  const activeTab = ['prescriptions', 'drafts', 'receive', 'levels', 'expired'].includes(requestedTab) ? requestedTab : 'prescriptions'
  const openId = searchParams.get('id') || ''

  const [loading, setLoading] = useState(true)
  const [savingMed, setSavingMed] = useState(false)
  const [medicines, setMedicines] = useState([])
  const [categories, setCategories] = useState(DEFAULT_MED_CATEGORIES)
  const [orders, setOrders] = useState([])
  const [selectedRx, setSelectedRx] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [orderStatus, setOrderStatus] = useState('pending')
  const [orderSearch, setOrderSearch] = useState('')
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('')
  const [orderYear, setOrderYear] = useState('')
  const [orderMonth, setOrderMonth] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [orderYears, setOrderYears] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [medSearch, setMedSearch] = useState('')
  const [debouncedMedSearch, setDebouncedMedSearch] = useState('')
  const [receiveLines, setReceiveLines] = useState(() => {
    // Only restore medicines already added; working (last) form always starts fresh on refresh.
    const draft = loadDraft(RECEIVE_DRAFT_KEY)
    const committed = Array.isArray(draft?.lines) ? draft.lines.filter(Boolean) : []
    return [emptyReceiveLine(), ...committed]
  })
  const [billFile, setBillFile] = useState(null)
  const billInputRef = useRef(null)
  const receiveLinesScrollRef = useRef(null)
  const [openCategory, setOpenCategory] = useState(null)
  const [receiveOptions, setReceiveOptions] = useState(() => loadReceiveOptions())
  const [fulfillDrafts, setFulfillDrafts] = useState(() => listFulfillDrafts())
  const [expiredRows, setExpiredRows] = useState([])
  const [expiredLoading, setExpiredLoading] = useState(false)
  const [expiredSearch, setExpiredSearch] = useState('')
  const [debouncedExpiredSearch, setDebouncedExpiredSearch] = useState('')
  const [expiredYear, setExpiredYear] = useState('')
  const [expiredMonth, setExpiredMonth] = useState('')
  const [expiredDate, setExpiredDate] = useState('')
  const [expiredYears, setExpiredYears] = useState([])
  const [expiredTotal, setExpiredTotal] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedOrderSearch(orderSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [orderSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMedSearch(medSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [medSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedExpiredSearch(expiredSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [expiredSearch])

  async function loadMedicines() {
    const q = new URLSearchParams({ status: 'active', per_page: '200' })
    if (debouncedMedSearch) q.set('search', debouncedMedSearch)
    const medRes = await api(`/medicines?${q}`)
    setMedicines(medRes.data || [])
    if (Array.isArray(medRes.meta?.categories) && medRes.meta.categories.length) {
      const merged = [...DEFAULT_MED_CATEGORIES]
      for (const cat of medRes.meta.categories) {
        if (!merged.some((c) => c.value === cat.value)) merged.push(cat)
      }
      setCategories(merged)
    }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    try {
      const q = new URLSearchParams({ per_page: '50' })
      if (orderStatus && orderStatus !== 'all') q.set('status', orderStatus)
      if (debouncedOrderSearch) q.set('search', debouncedOrderSearch)
      if (orderDate) {
        q.set('date', orderDate)
      } else {
        if (orderYear) q.set('year', String(orderYear))
        if (orderMonth) q.set('month', String(orderMonth))
      }
      const res = await api(`/medicine-prescriptions?${q}`)
      setOrders(res.data || [])
      if (Array.isArray(res.meta?.available_years)) {
        setOrderYears(res.meta.available_years)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load prescriptions')
    } finally {
      setOrdersLoading(false)
    }
  }

  async function loadExpired() {
    setExpiredLoading(true)
    try {
      const q = new URLSearchParams({ per_page: '50' })
      if (debouncedExpiredSearch) q.set('search', debouncedExpiredSearch)
      if (expiredDate) {
        q.set('date', expiredDate)
      } else {
        if (expiredYear) q.set('year', String(expiredYear))
        if (expiredMonth) q.set('month', String(expiredMonth))
      }
      const res = await api(`/medicines/expired?${q}`)
      setExpiredRows(res.data || [])
      setExpiredTotal(Number(res.meta?.total || 0))
      if (Array.isArray(res.meta?.available_years)) {
        setExpiredYears(res.meta.available_years)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load expired medicines')
    } finally {
      setExpiredLoading(false)
    }
  }

  async function openOrder(id) {
    if (!id) {
      setSelectedRx(null)
      setModalOpen(false)
      return
    }
    try {
      const res = await api(`/medicine-prescriptions/${id}`)
      setSelectedRx(res.data)
      setModalOpen(true)
    } catch (err) {
      toast.error(err.message || 'Failed to open prescription')
    }
  }

  useEffect(() => {
    if (activeTab !== 'receive') return undefined
    const t = setTimeout(() => {
      // Persist only added medicines (all below the current working line at top).
      const committed = receiveLines.slice(1)
      if (committed.length) saveDraft(RECEIVE_DRAFT_KEY, { lines: committed })
      else clearDraft(RECEIVE_DRAFT_KEY)
    }, 400)
    return () => clearTimeout(t)
  }, [receiveLines, activeTab])

  useEffect(() => {
    if (!canUsePharmacy) return
    setLoading(true)
    Promise.all([loadMedicines(), loadOrders()])
      .catch((err) => toast.error(err.message || 'Failed to load pharmacy'))
      .finally(() => setLoading(false))
  }, [canUsePharmacy])

  useEffect(() => {
    if (!canUsePharmacy || loading) return
    loadOrders()
  }, [orderStatus, debouncedOrderSearch, orderYear, orderMonth, orderDate])

  useEffect(() => {
    if (!canUsePharmacy || loading) return
    if (activeTab === 'levels' || activeTab === 'receive') {
      loadMedicines().catch((err) => toast.error(err.message || 'Failed to load medicines'))
    }
    if (activeTab === 'drafts') {
      setFulfillDrafts(listFulfillDrafts())
    }
    if (activeTab === 'expired') {
      loadExpired()
    }
  }, [canUsePharmacy, loading, debouncedMedSearch, activeTab])

  useEffect(() => {
    if (!canUsePharmacy || loading || activeTab !== 'expired') return
    loadExpired()
  }, [canUsePharmacy, loading, activeTab, debouncedExpiredSearch, expiredYear, expiredMonth, expiredDate])

  useEffect(() => {
    if (!canUsePharmacy || loading || activeTab !== 'prescriptions') return
    if (openId) openOrder(openId)
  }, [openId, canUsePharmacy, loading, activeTab])

  if (!canUsePharmacy) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  function selectOrder(rx) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'prescriptions')
    next.set('id', String(rx.id))
    setSearchParams(next)
  }

  function closeOrder() {
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    setSearchParams(next)
    setSelectedRx(null)
    setModalOpen(false)
  }

  function updateReceiveLine(key, patch) {
    setReceiveLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function applyExistingMedicine(lineKey, medicineId) {
    if (!medicineId || medicineId === '__new__') {
      updateReceiveLine(lineKey, {
        medicine_id: '',
        name: '',
        generic_name: '',
        strength: '',
        manufacturer: '',
      })
      return
    }
    const med = medicines.find((m) => String(m.id) === String(medicineId))
    if (!med) return
    updateReceiveLine(lineKey, {
      medicine_id: String(med.id),
      name: med.name || '',
      generic_name: med.generic_name || '',
      category: med.category || 'other',
      category_custom: '',
      form: med.form || 'tablet',
      strength: med.strength || '',
      unit: med.unit || 'tablet',
      manufacturer: med.manufacturer || '',
      reorder_level: String(med.reorder_level ?? 20),
      unit_price: med.unit_price != null ? String(med.unit_price) : '',
    })
  }

  function toggleCategory(key) {
    setOpenCategory((prev) => (prev === key ? null : key))
  }

  async function handleReceiveBatch(e) {
    e.preventDefault()
    if (!billFile) {
      toast.error('Bill / receipt image is required at the end')
      return
    }
    if (!isWithinUploadLimit(billFile)) {
      toast.error(uploadTooLargeMessage('Bill image'))
      return
    }

    const items = []
    for (const line of receiveLines) {
      const category = line.category === '__new__' ? (line.category_custom || '').trim() : line.category
      if (!line.name.trim() || !category || !line.stock_qty || line.unit_price === '') {
        toast.error('Fill name, category, qty and price on every medicine line')
        return
      }
      const row = {
        name: line.name.trim(),
        generic_name: line.generic_name || null,
        category,
        form: line.form,
        strength: line.strength || null,
        unit: line.unit,
        manufacturer: line.manufacturer || null,
        stock_qty: Number(line.stock_qty),
        reorder_level: Number(line.reorder_level || 20),
        unit_price: Number(line.unit_price),
        batch_no: line.batch_no || null,
        expiry_date: line.expiry_date || null,
        supplier: line.supplier || null,
        notes: line.notes || null,
      }
      if (line.medicine_id) row.medicine_id = Number(line.medicine_id)
      items.push(row)
    }

    setSavingMed(true)
    try {
      const body = new FormData()
      items.forEach((item, index) => {
        Object.entries(item).forEach(([key, value]) => {
          if (value === null || value === undefined || value === '') return
          body.append(`items[${index}][${key}]`, String(value))
        })
      })
      body.append('bill_image', billFile)

      const data = await api('/medicines/batch', { method: 'POST', body })
      toast.success(data.message || 'Medicines added')
      setReceiveOptions(rememberReceiveOptions(receiveLines))
      setReceiveLines([emptyReceiveLine()])
      setBillFile(null)
      if (billInputRef.current) billInputRef.current.value = ''
      clearDraft(RECEIVE_DRAFT_KEY)
      await loadMedicines()
    } catch (err) {
      toast.error(err.message || 'Failed to receive stock')
    } finally {
      setSavingMed(false)
    }
  }

  return (
    <div className="page print-page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Clinical Support</p>
          <h2>Dispenser</h2>
        </div>
        {activeTab === 'levels' ? (
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
          {activeTab === 'prescriptions' ? (
            <section className="panel no-print">
              <div className="panel-head">
                <h3>Prescriptions</h3>
              </div>
              <div className="list-toolbar petty-list-toolbar">
                <input
                  className="ui-input"
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search patient or code"
                  aria-label="Search prescriptions"
                />
                <select
                  className="ui-select"
                  value={orderYear}
                  onChange={(e) => {
                    setOrderYear(e.target.value)
                    setOrderDate('')
                  }}
                  aria-label="Year"
                >
                  <option value="">Year</option>
                  {orderYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
                <select
                  className="ui-select"
                  value={orderMonth}
                  onChange={(e) => {
                    setOrderMonth(e.target.value)
                    setOrderDate('')
                  }}
                  aria-label="Month"
                >
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  value={orderDate}
                  onChange={(e) => {
                    setOrderDate(e.target.value)
                    if (e.target.value) {
                      setOrderYear('')
                      setOrderMonth('')
                    }
                  }}
                  aria-label="Date"
                />
                <select
                  className="ui-select"
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  aria-label="Status"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {ordersLoading ? (
                <SkeletonCards count={2} />
              ) : orders.length === 0 ? (
                <p className="panel-copy">No prescriptions for this filter.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel pharmacy-orders-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Specialty</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((rx) => (
                        <tr key={rx.id} onClick={() => selectOrder(rx)} style={{ cursor: 'pointer' }}>
                          <td>
                            {rx.prescription_code}
                            {rx.is_handwritten ? <><br /><small>Handwritten</small></> : null}
                          </td>
                          <td>{rx.patient?.full_name || rx.patient?.patient_code || '—'}</td>
                          <td>{doctorName(rx)}</td>
                          <td>{doctorSpecialty(rx)}</td>
                          <td>{rx.is_handwritten && !(rx.items || []).length ? 'Photo' : (rx.items?.length || 0)}</td>
                          <td>
                            <span className={`badge ${rx.status === 'pending' ? 'badge-warn' : 'badge-ok'}`}>
                              {rx.status === 'pending' ? 'Pending' : 'Dispensed'}
                            </span>
                          </td>
                          <td>{formatWhen(rx.prescribed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'drafts' ? (
            <section className="panel no-print">
              <div className="panel-head">
                <h3>Drafts</h3>
                <Button type="button" variant="secondary" onClick={() => setFulfillDrafts(listFulfillDrafts())}>
                  Refresh
                </Button>
              </div>
              {fulfillDrafts.length === 0 ? (
                <p className="panel-copy">No fulfill drafts saved.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel">
                  <table className="data-table" style={{ minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th>Prescription</th>
                        <th>Patient</th>
                        <th>Lines</th>
                        <th>Saved</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {fulfillDrafts.map((draft) => (
                        <tr key={draft.id}>
                          <td>{draft.prescription_code || `Rx #${draft.id}`}</td>
                          <td>{draft.patient_name || '—'}</td>
                          <td>{draft.line_count}</td>
                          <td>{draft.saved_at ? formatWhen(new Date(draft.saved_at).toISOString()) : '—'}</td>
                          <td>
                            <div className="form-actions" style={{ margin: 0, justifyContent: 'flex-end' }}>
                              <Button
                                type="button"
                                onClick={() => navigate(`/app/pharmacy/fulfill/${draft.id}?draft=1`)}
                              >
                                Open draft
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  clearDraft(`fulfill_${draft.id}`)
                                  setFulfillDrafts(listFulfillDrafts())
                                  toast.success('Draft deleted')
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'receive' ? (
            <form className="panel no-print" onSubmit={handleReceiveBatch}>
              <div className="panel-head">
                <h3>Receive stock</h3>
                <div className="panel-head-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={receiveLines.length <= 1 && !receiveLines[0]?.name && !receiveLines[0]?.medicine_id && !receiveLines[0]?.stock_qty}
                    onClick={() => {
                      setReceiveLines([emptyReceiveLine()])
                      clearDraft(RECEIVE_DRAFT_KEY)
                      toast.success('All medicines cleared')
                    }}
                  >
                    Delete all
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const working = receiveLines[0]
                      const hasWork = working && (
                        working.medicine_id
                        || String(working.name || '').trim()
                        || String(working.stock_qty || '').trim()
                        || String(working.unit_price || '').trim()
                        || String(working.batch_no || '').trim()
                      )
                      if (!hasWork) {
                        toast.error('Fill the current medicine before adding another')
                        return
                      }
                      setReceiveLines((prev) => [emptyReceiveLine(), ...prev])
                      requestAnimationFrame(() => {
                        receiveLinesScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                      })
                    }}
                  >
                    Add medicine
                  </Button>
                </div>
              </div>
              <div ref={receiveLinesScrollRef} className="rx-lines-scroll pharmacy-receive-lines">
                {receiveLines.map((line, index) => (
                  <div key={line.key} className="rx-line-card">
                    <div className="rx-line-card-head">
                      <strong>Medicine {index + 1}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={receiveLines.length <= 1}
                        onClick={() => setReceiveLines((prev) => {
                          const next = prev.filter((row) => row.key !== line.key)
                          if (!next.length) return [emptyReceiveLine()]
                          if (prev[0]?.key === line.key) return [emptyReceiveLine(), ...next]
                          return next
                        })}
                      >
                        Delete
                      </Button>
                    </div>
                    <div className="form-grid">
                      <div className="ui-field full">
                        <label>Select medicine</label>
                        <ScrollSelect
                          id={`recv_med_${line.key}`}
                          searchable
                          value={line.medicine_id || '__new__'}
                          options={[
                            { value: '__new__', label: 'New medicine…' },
                            ...medicines.map((m) => ({
                              value: String(m.id),
                              label: `${m.name}${m.strength ? ` · ${m.strength}` : ''} (${m.category_label || m.category})`,
                            })),
                          ]}
                          onChange={(value) => applyExistingMedicine(line.key, value)}
                        />
                      </div>
                      {!line.medicine_id ? (
                        <div className="ui-field">
                          <label>Medicine name</label>
                          <input
                            className="ui-input"
                            required
                            value={line.name}
                            onChange={(e) => updateReceiveLine(line.key, { name: e.target.value, medicine_id: '' })}
                          />
                        </div>
                      ) : null}
                      <div className="ui-field">
                        <label>Generic name</label>
                        <ScrollSelect
                          id={`recv_generic_${line.key}`}
                          searchable
                          allowCreate
                          createLabel="Add"
                          placeholder="Select or add"
                          value={line.generic_name}
                          options={uniqueSelectOptions(
                            medicines.map((m) => m.generic_name),
                            receiveOptions.generic_name,
                            receiveLines.map((row) => row.generic_name),
                          )}
                          onChange={(value) => {
                            updateReceiveLine(line.key, { generic_name: value })
                            setReceiveOptions((prev) => appendReceiveOption(prev, 'generic_name', value))
                          }}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Category</label>
                        <ScrollSelect
                          id={`recv_cat_${line.key}`}
                          required
                          searchable
                          allowCreate
                          createLabel="Add"
                          placeholder="Select or add"
                          value={line.category === '__new__' ? (line.category_custom || '') : line.category}
                          options={[
                            ...categories.map((c) => ({ value: c.value, label: c.label })),
                            ...uniqueSelectOptions(receiveOptions.category).filter(
                              (opt) => !categories.some((c) => c.value === opt.value)
                            ),
                          ]}
                          onChange={(value) => {
                            const known = categories.some((c) => c.value === value)
                            if (known) {
                              updateReceiveLine(line.key, { category: value, category_custom: '' })
                              return
                            }
                            updateReceiveLine(line.key, { category: value, category_custom: value })
                          }}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Form</label>
                        <ScrollSelect
                          id={`recv_form_${line.key}`}
                          required
                          value={line.form}
                          options={FORMS}
                          onChange={(value) => updateReceiveLine(line.key, { form: value })}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Strength</label>
                        <ScrollSelect
                          id={`recv_strength_${line.key}`}
                          searchable
                          allowCreate
                          createLabel="Add"
                          placeholder="Select or add"
                          value={line.strength}
                          options={uniqueSelectOptions(
                            medicines.map((m) => m.strength),
                            receiveOptions.strength,
                            receiveLines.map((row) => row.strength),
                          )}
                          onChange={(value) => {
                            updateReceiveLine(line.key, { strength: value })
                            setReceiveOptions((prev) => appendReceiveOption(prev, 'strength', value))
                          }}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Unit</label>
                        <ScrollSelect
                          id={`recv_unit_${line.key}`}
                          required
                          value={line.unit}
                          options={UNITS}
                          onChange={(value) => updateReceiveLine(line.key, { unit: value })}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Quantity</label>
                        <input className="ui-input" type="number" min="1" required value={line.stock_qty} onChange={(e) => updateReceiveLine(line.key, { stock_qty: e.target.value })} />
                      </div>
                      <div className="ui-field">
                        <label>Unit price (PKR)</label>
                        <input className="ui-input" type="number" min="0" step="0.01" required value={line.unit_price} onChange={(e) => updateReceiveLine(line.key, { unit_price: e.target.value })} />
                      </div>
                      <div className="ui-field">
                        <label>Batch no.</label>
                        <ScrollSelect
                          id={`recv_batch_${line.key}`}
                          searchable
                          allowCreate
                          createLabel="Add"
                          placeholder="Select or add"
                          value={line.batch_no}
                          options={uniqueSelectOptions(
                            receiveOptions.batch_no,
                            receiveLines.map((row) => row.batch_no),
                          )}
                          onChange={(value) => {
                            updateReceiveLine(line.key, { batch_no: value })
                            setReceiveOptions((prev) => appendReceiveOption(prev, 'batch_no', value))
                          }}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Expiry</label>
                        <input className="ui-input" type="date" value={line.expiry_date} onChange={(e) => updateReceiveLine(line.key, { expiry_date: e.target.value })} />
                      </div>
                      <div className="ui-field">
                        <label>Supplier</label>
                        <ScrollSelect
                          id={`recv_supplier_${line.key}`}
                          searchable
                          allowCreate
                          createLabel="Add"
                          placeholder="Select or add"
                          value={line.supplier}
                          options={uniqueSelectOptions(
                            medicines.map((m) => m.supplier).filter(Boolean),
                            receiveOptions.supplier,
                            receiveLines.map((row) => row.supplier),
                          )}
                          onChange={(value) => {
                            updateReceiveLine(line.key, { supplier: value })
                            setReceiveOptions((prev) => appendReceiveOption(prev, 'supplier', value))
                          }}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Manufacturer</label>
                        <ScrollSelect
                          id={`recv_mfr_${line.key}`}
                          searchable
                          allowCreate
                          createLabel="Add"
                          placeholder="Select or add"
                          value={line.manufacturer}
                          options={uniqueSelectOptions(
                            medicines.map((m) => m.manufacturer),
                            receiveOptions.manufacturer,
                            receiveLines.map((row) => row.manufacturer),
                          )}
                          onChange={(value) => {
                            updateReceiveLine(line.key, { manufacturer: value })
                            setReceiveOptions((prev) => appendReceiveOption(prev, 'manufacturer', value))
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="ui-field full">
                  <label htmlFor="bill_image">Bill / receipt</label>
                  <input
                    id="bill_image"
                    ref={billInputRef}
                    className="ui-input"
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      if (file && !isWithinUploadLimit(file)) {
                        toast.error(uploadTooLargeMessage('Bill image'))
                        e.target.value = ''
                        setBillFile(null)
                        return
                      }
                      setBillFile(file)
                    }}
                  />
                </div>
                <div className="form-actions full">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const committed = receiveLines.slice(1)
                      if (committed.length) saveDraft(RECEIVE_DRAFT_KEY, { lines: committed })
                      else clearDraft(RECEIVE_DRAFT_KEY)
                      toast.success(committed.length ? 'Draft saved' : 'No added medicines to save')
                    }}
                  >
                    Save draft
                  </Button>
                  <Button type="submit" disabled={savingMed || !billFile}>
                    {savingMed ? 'Saving…' : 'Submit all'}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}

          {activeTab === 'levels' ? (
            <section className="panel print-stock-panel">
              <header className="print-dash-head">
                <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
                <h2>Medicine stock levels</h2>
              </header>
              <div className="panel-head no-print"><h3>Stock levels</h3></div>
              <div className="list-toolbar no-print">
                <input
                  className="ui-input"
                  type="search"
                  value={medSearch}
                  onChange={(e) => setMedSearch(e.target.value)}
                  placeholder="Search medicine"
                  aria-label="Search medicines"
                />
              </div>
              {medicines.length === 0 ? (
                <p className="panel-copy">No medicines in store.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel print-table-wrap no-print">
                  <table className="data-table stock-level-table" style={{ minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} aria-hidden />
                        <th>Category</th>
                        <th>Items</th>
                        <th>Total qty</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildStockCategories(medicines, categories).map((group) => {
                        const open = openCategory === group.key
                        return (
                          <Fragment key={group.key}>
                            <tr
                              className={`stock-level-row${group.lowCount ? ' is-low' : ''}${open ? ' is-open' : ''}`}
                              onClick={() => toggleCategory(group.key)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="stock-level-toggle">{open ? '−' : '+'}</td>
                              <td>{group.label}</td>
                              <td>{group.items.length}</td>
                              <td>{group.totalQty}</td>
                              <td>
                                {group.lowCount > 0 ? (
                                  <span className="badge badge-warn">Low stock</span>
                                ) : group.items.length ? (
                                  <span className="badge badge-ok">OK</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                            {open ? (
                              <tr className="stock-level-expand">
                                <td colSpan={5}>
                                  {group.items.length === 0 ? (
                                    <p className="panel-copy" style={{ margin: 0, padding: '8px 4px' }}>
                                      No medicines in this category.
                                    </p>
                                  ) : (
                                    <table className="data-table stock-level-inner" style={{ minWidth: 0 }}>
                                      <thead>
                                        <tr>
                                          <th>Code</th>
                                          <th>Name</th>
                                          {group.key === 'all' ? <th>Category</th> : null}
                                          <th>Form</th>
                                          <th>Stock</th>
                                          <th>Price</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {group.items.map((m) => (
                                          <tr key={m.id} className={m.low_stock ? 'is-low-med' : undefined}>
                                            <td>{m.medicine_code}</td>
                                            <td>
                                              {m.name}
                                              {m.strength ? <><br /><small>{m.strength}</small></> : null}
                                            </td>
                                            {group.key === 'all' ? (
                                              <td>{m.category_label || m.category || '—'}</td>
                                            ) : null}
                                            <td>{m.form || '—'}</td>
                                            <td>
                                              {m.stock_qty} {m.unit}
                                              {m.low_stock ? <span className="badge badge-warn"> Low</span> : null}
                                            </td>
                                            <td>{formatPkr(m.unit_price)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="print-only print-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Stock</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((m) => (
                      <tr key={`print-${m.id}`}>
                        <td>{m.category_label || m.category || '—'}</td>
                        <td>{m.medicine_code}</td>
                        <td>{m.name}{m.strength ? ` · ${m.strength}` : ''}</td>
                        <td>{m.stock_qty} {m.unit}{m.low_stock ? ' (low)' : ''}</td>
                        <td>{formatPkr(m.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === 'expired' ? (
            <section className="panel no-print">
              <div className="panel-head">
                <h3>Expired medicines</h3>
                <span className="badge badge-warn">{expiredTotal} expired</span>
              </div>
              <div className="list-toolbar petty-list-toolbar">
                <input
                  className="ui-input"
                  type="search"
                  value={expiredSearch}
                  onChange={(e) => setExpiredSearch(e.target.value)}
                  placeholder="Search name or code"
                  aria-label="Search expired medicines"
                />
                <select
                  className="ui-select"
                  value={expiredYear}
                  onChange={(e) => {
                    setExpiredYear(e.target.value)
                    setExpiredDate('')
                  }}
                  aria-label="Year"
                >
                  <option value="">Year</option>
                  {expiredYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
                <select
                  className="ui-select"
                  value={expiredMonth}
                  onChange={(e) => {
                    setExpiredMonth(e.target.value)
                    setExpiredDate('')
                  }}
                  aria-label="Month"
                >
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  value={expiredDate}
                  onChange={(e) => {
                    setExpiredDate(e.target.value)
                    if (e.target.value) {
                      setExpiredYear('')
                      setExpiredMonth('')
                    }
                  }}
                  aria-label="Date"
                />
              </div>
              {expiredLoading ? (
                <SkeletonCards count={2} />
              ) : expiredRows.length === 0 ? (
                <p className="panel-copy">No expired batches for this filter.</p>
              ) : (
                <div className="scroll-panel dash-scroll-panel pharmacy-orders-scroll">
                  <table className="data-table expired-med-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Batch</th>
                        <th>Qty</th>
                        <th>Expiry</th>
                        <th>Days</th>
                        <th>Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiredRows.map((row) => (
                        <tr key={row.id} className="expired-med-row">
                          <td>{row.medicine?.medicine_code || '—'}</td>
                          <td>
                            {row.medicine?.name || '—'}
                            {row.medicine?.strength ? <><br /><small>{row.medicine.strength}</small></> : null}
                          </td>
                          <td>{row.batch_no || '—'}</td>
                          <td>{row.quantity} {row.medicine?.unit || ''}</td>
                          <td>{row.expiry_date || '—'}</td>
                          <td>
                            {row.days_expired == null
                              ? '—'
                              : row.days_expired === 0
                                ? 'Today'
                                : `${row.days_expired} day${row.days_expired === 1 ? '' : 's'}`}
                          </td>
                          <td>{formatWhen(row.received_at)}</td>
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
        open={modalOpen && !!selectedRx}
        title={selectedRx?.prescription_code || 'Prescription'}
        onClose={closeOrder}
        hideFooter
        size="md"
      >
        {selectedRx ? (
          <div className="rx-modal-body">
            <dl className="rx-meta-list no-print">
              <div className="rx-meta-row">
                <dt>Patient</dt>
                <dd>
                  {selectedRx.patient?.full_name || '—'}
                  {selectedRx.patient?.patient_code ? ` · ${selectedRx.patient.patient_code}` : ''}
                </dd>
              </div>
              <div className="rx-meta-row">
                <dt>Doctor</dt>
                <dd>{doctorName(selectedRx)}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Specialty</dt>
                <dd>{doctorSpecialty(selectedRx)}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Nurse</dt>
                <dd>{selectedRx.nurse?.name || '—'}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Prescribed</dt>
                <dd>{formatWhen(selectedRx.prescribed_at)}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Status</dt>
                <dd>{selectedRx.status === 'pending' ? 'Pending' : 'Dispensed'}</dd>
              </div>
            </dl>

            {selectedRx.handwritten_image_url && selectedRx.status === 'pending' ? (
              <div className="rx-hw-preview no-print">
                <img src={selectedRx.handwritten_image_url} alt="Handwritten prescription" />
              </div>
            ) : null}

            {selectedRx.status === 'dispensed' ? (
              <div className="print-stock-panel">
                <header className="print-dash-head">
                  <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
                  <h2>Medicine slip</h2>
                  <p>{selectedRx.prescription_code}</p>
                </header>
                <div className="rx-lines-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Qty</th>
                        <th>Dosage</th>
                        <th>When to give</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedRx.items || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.medicine_name}</td>
                          <td>{item.dispensed_qty || item.quantity}</td>
                          <td>{item.dosage || '—'}</td>
                          <td>{item.frequency || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rx-modal-actions no-print">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(`/app/medicine-slips/${selectedRx.id}?autoprint=1`)}
                  >
                    Print slip
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeOrder}>Close</Button>
                </div>
              </div>
            ) : (
              <div className="rx-modal-actions no-print">
                <Button
                  type="button"
                  onClick={() => navigate(`/app/pharmacy/fulfill/${selectedRx.id}`)}
                >
                  {selectedRx.is_handwritten && !(selectedRx.items || []).length
                    ? 'Write medicines'
                    : 'Open fulfill page'}
                </Button>
                {hasFulfillDraft(selectedRx.id) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(`/app/pharmacy/fulfill/${selectedRx.id}?draft=1`)}
                  >
                    Open draft
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
