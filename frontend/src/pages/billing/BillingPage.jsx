import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyInvoice = {
  admission_id: '',
  fee_package_id: '',
  discount: '0',
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

  function setInv(key, value) {
    setInvoiceForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPay(key, value) {
    setPaymentForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
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

  useEffect(() => {
    load()
  }, [payTab])

  const openInvoices = useMemo(
    () => invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial'),
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
          notes: invoiceForm.notes || null,
        },
      })
      toast.success(`Invoice ${data.data.invoice_code} created`)
      setInvoiceForm(emptyInvoice)
      load()
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
      load()
    } catch (err) {
      toast.error(err.message || 'Payment failed')
    } finally {
      setSavingPayment(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h2>Fees & payments</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-ghost ui-btn-md" to="/app/home/finance">
            Dashboard
          </Link>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <div className="stat-grid">
            <article className="stat-card">
              <p>Open invoices</p>
              <strong>{openInvoices.length}</strong>
            </article>
            <article className="stat-card">
              <p>Outstanding</p>
              <strong>{formatPkr(openInvoices.reduce((s, i) => s + Number(i.balance || 0), 0))}</strong>
            </article>
            <article className="stat-card">
              <p>Pending requests</p>
              <strong>{payments.filter((p) => p.approval_status === 'pending').length || (payTab === 'pending' ? payments.length : '—')}</strong>
            </article>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h3>Fee packages</h3>
            </div>
            {packages.length === 0 ? (
              <p className="panel-copy">No packages configured.</p>
            ) : (
              <div className="table-wrap scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Days</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.program_days}</td>
                        <td>{formatPkr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
                  if (inv) setPay('amount', String(inv.balance))
                }}
              >
                <option value="">Select invoice</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_code} · {i.patient?.full_name} · bal {formatPkr(i.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="amount">Amount (PKR)</label>
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
                <p className="field-note">Balance {formatPkr(selectedInvoice.balance)} — partial = installment</p>
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
                          <span className="badge">{i.status}</span>
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
              <div className="entity-card-grid scroll-panel dash-scroll-panel">
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
