import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import FeesPaymentsPanel from './FeesPaymentsPanel'
import '../pages.css'

const VALID_TABS = new Set(['fees', 'petty', 'bills'])

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

const emptyPetty = {
  title: '',
  amount: '',
  spent_for: '',
  spent_for_custom: '',
  reason: '',
  payment_method: 'cash',
  expense_date: new Date().toISOString().slice(0, 10),
  notes: '',
}

const BILL_TYPES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'gas', label: 'Gas' },
  { value: 'rent', label: 'Rent' },
  { value: 'water', label: 'Water' },
  { value: 'internet', label: 'Internet' },
  { value: 'other', label: 'Other' },
]

const emptyBill = {
  bill_type: 'electricity',
  bill_type_custom: '',
  amount: '',
  payment_method: 'bank',
  bill_date: new Date().toISOString().slice(0, 10),
  notes: '',
}

export default function BillingPage() {
  const { user } = useAuth()
  const isFinance = user?.role_slug === 'finance'
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'fees'
  const pageTab = VALID_TABS.has(rawTab) ? rawTab : 'fees'

  function setPageTab(tab) {
    setSearchParams(tab === 'fees' ? { tab: 'fees' } : { tab }, { replace: true })
  }

  const [loading, setLoading] = useState(false)

  const [pettyForm, setPettyForm] = useState(emptyPetty)
  const [pettyRows, setPettyRows] = useState([])
  const [spentForOptions, setSpentForOptions] = useState([])
  const [pettyYears, setPettyYears] = useState([])
  const [pettyYear, setPettyYear] = useState('')
  const [pettyMonth, setPettyMonth] = useState('')
  const [pettyDate, setPettyDate] = useState('')
  const [pettySearch, setPettySearch] = useState('')
  const [debouncedPettySearch, setDebouncedPettySearch] = useState('')
  const [savingPetty, setSavingPetty] = useState(false)
  const [pettyReady, setPettyReady] = useState(false)
  const [pettyTableLoading, setPettyTableLoading] = useState(false)

  const [billForm, setBillForm] = useState(emptyBill)
  const [billRows, setBillRows] = useState([])
  const [billTypesMeta, setBillTypesMeta] = useState([])
  const [billYears, setBillYears] = useState([])
  const [billYear, setBillYear] = useState('')
  const [billMonth, setBillMonth] = useState('')
  const [billDateFilter, setBillDateFilter] = useState('')
  const [billSearch, setBillSearch] = useState('')
  const [debouncedBillSearch, setDebouncedBillSearch] = useState('')
  const [billTypeFilter, setBillTypeFilter] = useState('')
  const [savingBill, setSavingBill] = useState(false)
  const [billReady, setBillReady] = useState(false)
  const [billTableLoading, setBillTableLoading] = useState(false)

  function setPetty(key, value) {
    setPettyForm((prev) => ({ ...prev, [key]: value }))
  }

  function setBill(key, value) {
    setBillForm((prev) => ({ ...prev, [key]: value }))
  }

  async function loadPetty() {
    const q = new URLSearchParams({ per_page: '50' })
    if (debouncedPettySearch) q.set('q', debouncedPettySearch)
    if (pettyDate) {
      q.set('date', pettyDate)
    } else {
      if (pettyYear) q.set('year', String(pettyYear))
      if (pettyMonth) q.set('month', String(pettyMonth))
    }
    const res = await api(`/petty-expenses?${q}`)
    setPettyRows(res.data || [])
    setSpentForOptions(res.meta?.spent_for_options || [])
    setPettyYears(res.meta?.available_years || [])
  }

  async function loadBills() {
    const q = new URLSearchParams({ per_page: '50' })
    if (debouncedBillSearch) q.set('q', debouncedBillSearch)
    if (billTypeFilter) q.set('bill_type', billTypeFilter)
    if (billDateFilter) {
      q.set('date', billDateFilter)
    } else {
      if (billYear) q.set('year', String(billYear))
      if (billMonth) q.set('month', String(billMonth))
    }
    const res = await api(`/facility-bills?${q}`)
    setBillRows(res.data || [])
    setBillYears(res.meta?.available_years || [])
    setBillTypesMeta(res.meta?.bill_types || [])
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPettySearch(pettySearch.trim()), 350)
    return () => clearTimeout(t)
  }, [pettySearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBillSearch(billSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [billSearch])

  useEffect(() => {
    if (pageTab !== 'petty') return
    const firstLoad = !pettyReady
    if (firstLoad) setLoading(true)
    else setPettyTableLoading(true)
    loadPetty()
      .catch((err) => toast.error(err.message || 'Failed to load petty expenses'))
      .finally(() => {
        if (firstLoad) setLoading(false)
        setPettyTableLoading(false)
        setPettyReady(true)
      })
  }, [pageTab, debouncedPettySearch, pettyYear, pettyMonth, pettyDate])

  useEffect(() => {
    if (pageTab !== 'bills') return
    const firstLoad = !billReady
    if (firstLoad) setLoading(true)
    else setBillTableLoading(true)
    loadBills()
      .catch((err) => toast.error(err.message || 'Failed to load facility bills'))
      .finally(() => {
        if (firstLoad) setLoading(false)
        setBillTableLoading(false)
        setBillReady(true)
      })
  }, [pageTab, debouncedBillSearch, billTypeFilter, billYear, billMonth, billDateFilter])

  async function handlePetty(e) {
    e.preventDefault()
    const spentFor =
      pettyForm.spent_for === '__new__'
        ? (pettyForm.spent_for_custom || '').trim()
        : (pettyForm.spent_for || '').trim()
    if (!pettyForm.title.trim() || !spentFor || !pettyForm.reason.trim()) {
      toast.error('Item, spent for, and reason are required')
      return
    }
    setSavingPetty(true)
    try {
      const data = await api('/petty-expenses', {
        method: 'POST',
        body: {
          title: pettyForm.title.trim(),
          amount: Number(pettyForm.amount),
          spent_for: spentFor,
          reason: pettyForm.reason.trim(),
          payment_method: pettyForm.payment_method || 'cash',
          expense_date: pettyForm.expense_date || null,
          notes: pettyForm.notes || null,
        },
      })
      toast.success(`${data.data.expense_code} recorded`)
      setPettyForm({ ...emptyPetty, spent_for: spentFor })
      await loadPetty()
    } catch (err) {
      toast.error(err.message || 'Failed to save petty expense')
    } finally {
      setSavingPetty(false)
    }
  }

  async function handleBill(e) {
    e.preventDefault()
    const billType =
      billForm.bill_type === '__new__'
        ? (billForm.bill_type_custom || '').trim()
        : billForm.bill_type
    if (!billType) {
      toast.error('Bill type is required')
      return
    }
    setSavingBill(true)
    try {
      const data = await api('/facility-bills', {
        method: 'POST',
        body: {
          bill_type: billType,
          amount: Number(billForm.amount || 0),
          payment_method: billForm.payment_method || 'bank',
          bill_date: billForm.bill_date || null,
          notes: billForm.notes || null,
        },
      })
      toast.success(`${data.data.bill_code} recorded`)
      setBillForm(emptyBill)
      await loadBills()
    } catch (err) {
      toast.error(err.message || 'Failed to save bill')
    } finally {
      setSavingBill(false)
    }
  }

  return (
    <div className={`page${isFinance ? ' finance-page' : ''}`}>
      {!isFinance ? (
        <>
          <div className="page-header no-print">
            <div>
              <p className="eyebrow">Finance</p>
              <h2>Billing & Finance</h2>
            </div>
          </div>

          <div className="page-tabs no-print" role="tablist" aria-label="Billing tabs">
            <button
              type="button"
              role="tab"
              className={`page-tab ${pageTab === 'fees' ? 'is-active' : ''}`}
              aria-selected={pageTab === 'fees'}
              onClick={() => setPageTab('fees')}
            >
              Fees & payments
            </button>
            <button
              type="button"
              role="tab"
              className={`page-tab ${pageTab === 'petty' ? 'is-active' : ''}`}
              aria-selected={pageTab === 'petty'}
              onClick={() => setPageTab('petty')}
            >
              Petty expenses
            </button>
            <button
              type="button"
              role="tab"
              className={`page-tab ${pageTab === 'bills' ? 'is-active' : ''}`}
              aria-selected={pageTab === 'bills'}
              onClick={() => setPageTab('bills')}
            >
              Facility bills
            </button>
          </div>
        </>
      ) : null}

      {loading ? (
        <SkeletonCards count={3} />
      ) : pageTab === 'bills' ? (
        <>
          <form className="panel form-grid no-print" onSubmit={handleBill}>
            <div className="panel-head full">
              <h3>Add facility bill</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="bill_type">Bill type</label>
              <select
                id="bill_type"
                className="ui-select"
                required
                value={billForm.bill_type}
                onChange={(e) => setBill('bill_type', e.target.value)}
              >
                {BILL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
                <option value="__new__">Add new…</option>
              </select>
            </div>
            {billForm.bill_type === '__new__' ? (
              <div className="ui-field">
                <label htmlFor="bill_type_custom">New bill type</label>
                <input
                  id="bill_type_custom"
                  className="ui-input"
                  required
                  value={billForm.bill_type_custom}
                  onChange={(e) => setBill('bill_type_custom', e.target.value)}
                />
              </div>
            ) : null}
            <div className="ui-field">
              <label htmlFor="bill_amount">Amount (PKR)</label>
              <input
                id="bill_amount"
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                required
                value={billForm.amount}
                onChange={(e) => setBill('amount', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="bill_date">Date</label>
              <input
                id="bill_date"
                className="ui-input"
                type="date"
                value={billForm.bill_date}
                onChange={(e) => setBill('bill_date', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="bill_pay">Payment</label>
              <select
                id="bill_pay"
                className="ui-select"
                value={billForm.payment_method}
                onChange={(e) => setBill('payment_method', e.target.value)}
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="bill_notes">Notes</label>
              <input
                id="bill_notes"
                className="ui-input"
                value={billForm.notes}
                onChange={(e) => setBill('notes', e.target.value)}
              />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingBill}>
                {savingBill ? 'Saving...' : 'Save bill'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head no-print">
              <div className="list-toolbar petty-list-toolbar">
                <select
                  className="ui-select"
                  value={billYear}
                  onChange={(e) => {
                    setBillYear(e.target.value)
                    setBillDateFilter('')
                  }}
                  aria-label="Year"
                >
                  <option value="">Year</option>
                  {billYears.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="ui-select"
                  value={billMonth}
                  onChange={(e) => {
                    setBillMonth(e.target.value)
                    setBillDateFilter('')
                  }}
                  aria-label="Month"
                >
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  value={billDateFilter}
                  onChange={(e) => {
                    setBillDateFilter(e.target.value)
                    if (e.target.value) {
                      setBillYear('')
                      setBillMonth('')
                    }
                  }}
                  aria-label="Date"
                />
                <select
                  className="ui-select"
                  value={billTypeFilter}
                  onChange={(e) => setBillTypeFilter(e.target.value)}
                  aria-label="Bill type"
                >
                  <option value="">Bill type</option>
                  {(billTypesMeta.length ? billTypesMeta : BILL_TYPES).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="search"
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search"
                />
              </div>
            </div>
            {billTableLoading ? (
              <SkeletonCards count={1} />
            ) : billRows.length === 0 ? (
              <p className="panel-copy">No facility bills yet.</p>
            ) : (
              <div className="scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Pay</th>
                      <th>Entered by</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.bill_code}</td>
                        <td>{row.bill_type_label || row.bill_type}</td>
                        <td>{formatPkr(row.amount)}</td>
                        <td>{row.payment_method}</td>
                        <td>{row.entered_by || '—'}</td>
                        <td>{row.bill_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : pageTab === 'petty' ? (
        <>
          <form className="panel form-grid no-print" onSubmit={handlePetty}>
            <div className="panel-head full">
              <h3>Add petty expense</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="petty_title">Item / what bought</label>
              <input
                id="petty_title"
                className="ui-input"
                required
                value={pettyForm.title}
                onChange={(e) => setPetty('title', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="petty_amount">Amount (PKR)</label>
              <input
                id="petty_amount"
                className="ui-input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={pettyForm.amount}
                onChange={(e) => setPetty('amount', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="petty_spent_for">Spent for</label>
              <select
                id="petty_spent_for"
                className="ui-select"
                required
                value={pettyForm.spent_for}
                onChange={(e) => setPetty('spent_for', e.target.value)}
              >
                <option value="">Select</option>
                {spentForOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__new__">Add new…</option>
              </select>
            </div>
            {pettyForm.spent_for === '__new__' ? (
              <div className="ui-field">
                <label htmlFor="petty_spent_for_custom">New name</label>
                <input
                  id="petty_spent_for_custom"
                  className="ui-input"
                  required
                  value={pettyForm.spent_for_custom}
                  onChange={(e) => setPetty('spent_for_custom', e.target.value)}
                />
              </div>
            ) : null}
            <div className="ui-field">
              <label htmlFor="petty_reason">Reason</label>
              <input
                id="petty_reason"
                className="ui-input"
                required
                value={pettyForm.reason}
                onChange={(e) => setPetty('reason', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="petty_date">Date</label>
              <input
                id="petty_date"
                className="ui-input"
                type="date"
                value={pettyForm.expense_date}
                onChange={(e) => setPetty('expense_date', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="petty_pay">Payment</label>
              <select
                id="petty_pay"
                className="ui-select"
                value={pettyForm.payment_method}
                onChange={(e) => setPetty('payment_method', e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="petty_notes">Notes</label>
              <input
                id="petty_notes"
                className="ui-input"
                value={pettyForm.notes}
                onChange={(e) => setPetty('notes', e.target.value)}
              />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingPetty}>
                {savingPetty ? 'Saving...' : 'Save expense'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head no-print">
              <div className="list-toolbar petty-list-toolbar">
                <select
                  className="ui-select"
                  value={pettyYear}
                  onChange={(e) => {
                    setPettyYear(e.target.value)
                    setPettyDate('')
                  }}
                  aria-label="Year"
                >
                  <option value="">Year</option>
                  {pettyYears.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="ui-select"
                  value={pettyMonth}
                  onChange={(e) => {
                    setPettyMonth(e.target.value)
                    setPettyDate('')
                  }}
                  aria-label="Month"
                >
                  <option value="">Month</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  className="ui-input"
                  type="date"
                  value={pettyDate}
                  onChange={(e) => {
                    setPettyDate(e.target.value)
                    if (e.target.value) {
                      setPettyYear('')
                      setPettyMonth('')
                    }
                  }}
                  aria-label="Date"
                />
                <input
                  className="ui-input"
                  type="search"
                  value={pettySearch}
                  onChange={(e) => setPettySearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search"
                />
              </div>
            </div>
            {pettyTableLoading ? (
              <SkeletonCards count={1} />
            ) : pettyRows.length === 0 ? (
              <p className="panel-copy">No petty expenses yet.</p>
            ) : (
              <div className="scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Amount</th>
                      <th>Spent for</th>
                      <th>Reason</th>
                      <th>Entered by</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pettyRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.expense_code}</td>
                        <td>{row.title}</td>
                        <td>{formatPkr(row.amount)}</td>
                        <td>{row.spent_for}</td>
                        <td>{row.reason}</td>
                        <td>{row.entered_by || '—'}</td>
                        <td>{row.expense_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <FeesPaymentsPanel />
      )}
    </div>
  )
}
