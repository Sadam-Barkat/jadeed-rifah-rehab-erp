import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
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

const emptyInvoice = {
  admission_id: '',
  fee_package_id: '',
  discount: '0',
  installment_count: '1',
  notes: '',
}

const emptyPayment = {
  invoice_id: '',
  amount: '',
  method: 'cash',
  reference: '',
  notes: '',
  proof_image: null,
}

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

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'bank', label: 'Bank' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'Easypaisa' },
]

const PAY_TABS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

export default function BillingPage() {
  const { user } = useAuth()
  const isFinance = user?.role_slug === 'finance'
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'fees'
  const pageTab = VALID_TABS.has(rawTab) ? rawTab : 'fees'

  function setPageTab(tab) {
    setSearchParams(tab === 'fees' ? { tab: 'fees' } : { tab }, { replace: true })
  }

  const [loading, setLoading] = useState(true)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [packages, setPackages] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [payTab, setPayTab] = useState('pending')
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)

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

  function setInv(key, value) {
    setInvoiceForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPay(key, value) {
    setPaymentForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPetty(key, value) {
    setPettyForm((prev) => ({ ...prev, [key]: value }))
  }

  function setBill(key, value) {
    setBillForm((prev) => ({ ...prev, [key]: value }))
  }

  async function loadBilling() {
    setLoading(true)
    try {
      const payQ = new URLSearchParams({ per_page: '50' })
      if (payTab) payQ.set('approval_status', payTab)

      const [pkgRes, admRes, invRes, payRes] = await Promise.all([
        api('/fee-packages?status=active'),
        api('/admissions?per_page=50'),
        api('/invoices?per_page=50'),
        api(`/payments?${payQ}`),
      ])
      setPackages(pkgRes.data || [])
      setAdmissions(admRes.data || [])
      setInvoices(invRes.data || [])
      setPayments(payRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
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
    if (pageTab !== 'fees') return
    loadBilling()
  }, [payTab, pageTab])

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

  const openInvoices = useMemo(
    () => invoices.filter((i) => i.status === 'unpaid' && Number(i.balance) > 0),
    [invoices]
  )

  const selectedInvoice = openInvoices.find((i) => String(i.id) === String(paymentForm.invoice_id))

  async function handleCreateInvoice(e) {
    e.preventDefault()
    setSavingInvoice(true)
    try {
      const data = await api('/invoices', {
        method: 'POST',
        body: {
          admission_id: Number(invoiceForm.admission_id),
          fee_package_id: invoiceForm.fee_package_id ? Number(invoiceForm.fee_package_id) : null,
          discount: invoiceForm.discount ? Number(invoiceForm.discount) : 0,
          installment_count: Math.max(1, Number(invoiceForm.installment_count) || 1),
          notes: invoiceForm.notes || null,
        },
      })
      toast.success(`Invoice ${data.data.invoice_code} created`)
      setInvoiceForm(emptyInvoice)
      loadBilling()
    } catch (err) {
      toast.error(err.message || 'Failed to create invoice')
    } finally {
      setSavingInvoice(false)
    }
  }

  async function handlePayment(e) {
    e.preventDefault()
    if (!paymentForm.proof_image) {
      toast.error('Payment proof image is required')
      return
    }
    setSavingPayment(true)
    try {
      const fd = new FormData()
      fd.append('invoice_id', String(Number(paymentForm.invoice_id)))
      fd.append('amount', String(Number(paymentForm.amount)))
      fd.append('method', paymentForm.method)
      if (paymentForm.reference) fd.append('reference', paymentForm.reference)
      if (paymentForm.notes) fd.append('notes', paymentForm.notes)
      fd.append('proof_image', paymentForm.proof_image)

      const data = await api('/payments', {
        method: 'POST',
        body: fd,
      })
      toast.success(data.message || 'Sent for admin approval')
      setPaymentForm(emptyPayment)
      setPayTab('pending')
      loadBilling()
    } catch (err) {
      toast.error(err.message || 'Payment failed')
    } finally {
      setSavingPayment(false)
    }
  }

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
        <>
          <form className="panel form-grid" onSubmit={handleCreateInvoice}>
            <div className="panel-head full">
              <h3>Create invoice</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="admission_id">Admission</label>
              <select
                id="admission_id"
                className="ui-select"
                required
                value={invoiceForm.admission_id}
                onChange={(e) => setInv('admission_id', e.target.value)}
              >
                <option value="">Select admission</option>
                {admissions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.admission_code} · {a.patient?.full_name} · {a.program_days}d
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="fee_package_id">Fee package</label>
              <select
                id="fee_package_id"
                className="ui-select"
                required
                value={invoiceForm.fee_package_id}
                onChange={(e) => setInv('fee_package_id', e.target.value)}
              >
                <option value="">Select package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatPkr(p.amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="discount">Discount (PKR)</label>
              <input
                id="discount"
                className="ui-input"
                type="number"
                min="0"
                value={invoiceForm.discount}
                onChange={(e) => setInv('discount', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="installment_count">Installments</label>
              <select
                id="installment_count"
                className="ui-select"
                value={invoiceForm.installment_count}
                onChange={(e) => setInv('installment_count', e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={String(n)}>
                    {n === 1 ? 'Full payment (1)' : `${n} installments`}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="inv_notes">Notes</label>
              <input
                id="inv_notes"
                className="ui-input"
                value={invoiceForm.notes}
                onChange={(e) => setInv('notes', e.target.value)}
              />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingInvoice || !admissions.length || !packages.length}>
                {savingInvoice ? 'Saving...' : 'Create invoice'}
              </Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handlePayment}>
            <div className="panel-head full">
              <h3>Submit fee / installment</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="invoice_id">Open invoice</label>
              <select
                id="invoice_id"
                className="ui-select"
                required
                value={paymentForm.invoice_id}
                onChange={(e) => {
                  const id = e.target.value
                  setPay('invoice_id', id)
                  const inv = openInvoices.find((i) => String(i.id) === id)
                  if (inv) {
                    const suggested = inv.installment_amount || inv.balance
                    setPay('amount', String(suggested))
                  }
                }}
              >
                <option value="">Select invoice</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_code} · {i.patient?.full_name} · bal {formatPkr(i.balance)}
                    {i.installment_count > 1 ? ` · ${i.installment_count} installments` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="amount">Installment amount (PKR)</label>
              <input
                id="amount"
                className="ui-input"
                type="number"
                min="1"
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPay('amount', e.target.value)}
              />
              {selectedInvoice ? (
                <p className="field-note">
                  Balance {formatPkr(selectedInvoice.balance)}
                  {selectedInvoice.installment_count > 1
                    ? ` · plan ${selectedInvoice.installment_count} × ${formatPkr(selectedInvoice.installment_amount)}`
                    : ''}
                </p>
              ) : null}
            </div>
            <div className="ui-field">
              <label htmlFor="method">Method</label>
              <select
                id="method"
                className="ui-select"
                value={paymentForm.method}
                onChange={(e) => setPay('method', e.target.value)}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="reference">Reference</label>
              <input
                id="reference"
                className="ui-input"
                value={paymentForm.reference}
                onChange={(e) => setPay('reference', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="proof_image">
                {paymentForm.method === 'cash' ? 'Cash proof image' : 'Payment screenshot'}
              </label>
              <input
                id="proof_image"
                className="ui-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => setPay('proof_image', e.target.files?.[0] || null)}
              />
            </div>
            <div className="ui-field full">
              <label htmlFor="pay_notes">Notes</label>
              <input
                id="pay_notes"
                className="ui-input"
                value={paymentForm.notes}
                onChange={(e) => setPay('notes', e.target.value)}
              />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingPayment || !openInvoices.length}>
                {savingPayment ? 'Sending…' : 'Send for admin approval'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Invoices</h3>
            </div>
            {invoices.length === 0 ? (
              <p className="panel-copy">No invoices yet.</p>
            ) : (
              <div className="table-wrap scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Package</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Plan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td>{i.invoice_code}</td>
                        <td>
                          {i.patient?.patient_code} · {i.patient?.full_name}
                        </td>
                        <td>{i.package_name}</td>
                        <td>{formatPkr(i.total_amount)}</td>
                        <td>{formatPkr(i.paid_amount)}</td>
                        <td>{formatPkr(i.balance)}</td>
                        <td>
                          {i.installment_count > 1
                            ? `${i.installment_count} × ${formatPkr(i.installment_amount)}`
                            : 'Full'}
                        </td>
                        <td>
                          <span className="badge">{i.status_label || i.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Payment requests</h3>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Payment status">
              {PAY_TABS.map((tab) => (
                <button
                  key={tab.id || 'all'}
                  type="button"
                  className={`filter-tab ${payTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setPayTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {payments.length === 0 ? (
              <p className="panel-copy">No payments in this list.</p>
            ) : (
              <div className="entity-card-grid">
                {payments.map((p) => (
                  <article key={p.id} className="entity-card">
                    <div className="entity-card-top">
                      <div>
                        <p className="entity-card-code">{p.payment_code}</p>
                        <h3>{formatPkr(p.amount)}</h3>
                      </div>
                      <span className="badge">{p.approval_status}</span>
                    </div>
                    <dl className="entity-card-meta">
                      <div>
                        <dt>Patient</dt>
                        <dd>{p.patient?.full_name || '—'}</dd>
                      </div>
                      <div>
                        <dt>Invoice</dt>
                        <dd>{p.invoice?.invoice_code || '—'}</dd>
                      </div>
                      <div>
                        <dt>Installment</dt>
                        <dd>#{p.installment_no || '—'}</dd>
                      </div>
                      <div>
                        <dt>Method</dt>
                        <dd>{p.method || '—'}</dd>
                      </div>
                    </dl>
                    <div className="entity-card-actions">
                      <Link className="ui-btn ui-btn-secondary ui-btn-sm" to={`/app/payments/${p.id}`}>
                        View
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
