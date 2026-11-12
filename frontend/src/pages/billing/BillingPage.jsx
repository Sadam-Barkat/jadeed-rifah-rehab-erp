import { useEffect, useState } from 'react'
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
}

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'bank', label: 'Bank' },
]

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [packages, setPackages] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
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
      const [pkgRes, admRes, invRes, payRes] = await Promise.all([
        api('/fee-packages?status=active'),
        api('/admissions?per_page=50'),
        api('/invoices?due_only=1&per_page=50'),
        api('/payments?per_page=50'),
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
  }, [])

  const openInvoices = invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial')

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
    setSavingPayment(true)
    try {
      const data = await api('/payments', {
        method: 'POST',
        body: {
          invoice_id: Number(paymentForm.invoice_id),
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null,
        },
      })
      toast.success(`Payment ${data.data.payment_code} recorded`)
      setPaymentForm(emptyPayment)
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
          <h2>Patient Fee & Billing</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h3>Fee packages</h3>
            </div>
            {packages.length === 0 ? (
              <p className="panel-copy">No packages configured.</p>
            ) : (
              <div className="table-wrap">
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
              <h3>Record payment</h3>
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
            <div className="form-actions full">
              <Button type="submit" disabled={savingPayment || !openInvoices.length}>
                {savingPayment ? 'Saving...' : 'Record payment'}
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
              <div className="table-wrap">
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
              <h3>Recent payments</h3>
            </div>
            {payments.length === 0 ? (
              <p className="panel-copy">No payments yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Invoice</th>
                      <th>Patient</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.payment_code}</td>
                        <td>{p.invoice?.invoice_code}</td>
                        <td>
                          {p.patient?.patient_code} · {p.patient?.full_name}
                        </td>
                        <td>{formatPkr(p.amount)}</td>
                        <td>{p.method}</td>
                        <td>{p.paid_at}</td>
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
