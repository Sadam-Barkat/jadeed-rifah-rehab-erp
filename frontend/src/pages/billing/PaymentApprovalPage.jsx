import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import '../pages.css'

export default function PaymentApprovalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role_slug === 'admin'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payment, setPayment] = useState(null)
  const [reason, setReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await api(`/payments/${id}`)
      setPayment(data.data)
    } catch (err) {
      toast.error(err.message || 'Failed to load payment')
      setPayment(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  function pendingBatchIds(current = payment) {
    const batch = Array.isArray(current?.batch_payments) ? current.batch_payments : []
    const ids = batch
      .filter((row) => row.approval_status === 'pending')
      .map((row) => Number(row.id))
    if (ids.length > 0) return ids
    return current?.approval_status === 'pending' ? [Number(current.id)] : []
  }

  async function approve() {
    const ids = pendingBatchIds()
    if (ids.length === 0) return
    setSaving(true)
    try {
      let last = null
      for (const payId of ids) {
        const data = await api(`/payments/${payId}/approve`, { method: 'POST' })
        last = data
      }
      toast.success(
        ids.length > 1
          ? `${ids.length} payments approved`
          : last?.message || 'Approved'
      )
      await load()
    } catch (err) {
      toast.error(err.message || 'Approve failed')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    const ids = pendingBatchIds()
    if (ids.length === 0) return
    setSaving(true)
    try {
      let last = null
      for (const payId of ids) {
        const data = await api(`/payments/${payId}/reject`, {
          method: 'POST',
          body: { reason: reason || null },
        })
        last = data
      }
      toast.success(
        ids.length > 1
          ? `${ids.length} payments rejected`
          : last?.message || 'Rejected'
      )
      await load()
    } catch (err) {
      toast.error(err.message || 'Reject failed')
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <Skeleton height={28} width="240px" />
        <Skeleton height={200} className="mt-3" />
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="page">
        <p className="panel-copy">Payment not found.</p>
        <Link className="ui-btn ui-btn-back ui-btn-md" to={isAdmin ? '/app/admin/finance' : '/app/billing?tab=fees&fees=pending'}>
          Back
        </Link>
      </div>
    )
  }

  const batch = Array.isArray(payment.batch_payments) ? payment.batch_payments : []
  const pendingBatch = batch.filter((row) => row.approval_status === 'pending')
  const pending = payment.approval_status === 'pending' || pendingBatch.length > 0
  const batchTotal = batch.reduce((s, row) => s + Number(row.amount || 0), 0)
  const backTo = isAdmin ? '/app/admin/finance' : '/app/billing?tab=fees&fees=pending'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Fee approval</p>
          <h2>{payment.payment_code}</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="back" onClick={() => navigate(backTo)}>Back</Button>
        </div>
      </div>

      {batch.length > 1 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Same proof · {batch.length} invoices</h3>
            <span className="badge">{formatPkr(batchTotal)}</span>
          </div>
          <div className="fees-installment-list">
            {batch.map((row) => (
              <div key={row.id} className="fees-installment-row">
                <div>
                  <strong>
                    Invoice #{row.installment_no || 1} · {row.invoice_code || row.payment_code}
                  </strong>
                  <span>{formatPkr(row.amount)}</span>
                </div>
                <span className="badge">{row.approval_status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Payment request</h3>
          <span className="badge">{payment.approval_status}</span>
        </div>
        <div className="detail-grid">
          <div>
            <span>Patient</span>
            <strong>
              {payment.patient?.patient_code} · {payment.patient?.full_name}
            </strong>
          </div>
          <div>
            <span>Phone</span>
            <strong>{payment.patient?.phone || '—'}</strong>
          </div>
          <div>
            <span>Invoice</span>
            <strong>{payment.invoice?.invoice_code || '—'}</strong>
          </div>
          <div>
            <span>Package</span>
            <strong>{payment.invoice?.package_name || '—'}</strong>
          </div>
          <div>
            <span>Invoice total</span>
            <strong>{formatPkr(payment.invoice?.total_amount)}</strong>
          </div>
          <div>
            <span>Invoice balance</span>
            <strong>{formatPkr(payment.invoice?.balance)}</strong>
          </div>
          <div>
            <span>This payment</span>
            <strong>{formatPkr(payment.amount)}</strong>
          </div>
          <div>
            <span>Invoice no.</span>
            <strong>#{payment.installment_no || payment.invoice?.installment_no || '—'}</strong>
          </div>
          <div>
            <span>Method</span>
            <strong>{payment.method || '—'}</strong>
          </div>
          <div>
            <span>Collected by</span>
            <strong>{payment.collected_by || '—'}</strong>
          </div>
          <div>
            <span>Paid at</span>
            <strong>{payment.paid_at || '—'}</strong>
          </div>
          {payment.notes ? (
            <div className="full">
              <span>Notes</span>
              <strong>{payment.notes}</strong>
            </div>
          ) : null}
          {payment.rejection_reason ? (
            <div className="full">
              <span>Rejection reason</span>
              <strong>{payment.rejection_reason}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {Array.isArray(payment.invoice_progress) && payment.invoice_progress.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Patient invoices</h3>
          </div>
          <div className="fees-installment-list">
            {payment.invoice_progress.map((inv) => (
              <div key={inv.id} className="fees-installment-row">
                <div>
                  <strong>
                    Invoice #{inv.installment_no || 1} · {inv.invoice_code}
                  </strong>
                  <span>
                    {inv.collection_status === 'paid'
                      ? `Paid ${formatPkr(inv.total_amount)}`
                      : `Balance ${formatPkr(inv.balance)}`}
                  </span>
                </div>
                <span className={`fee-status fee-status-${inv.collection_status || 'due'}`}>
                  {inv.collection_status_label || 'Due'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Proof</h3>
        </div>
        {payment.proof_image_url ? (
          <a href={payment.proof_image_url} target="_blank" rel="noreferrer" className="doc-preview doc-preview-wide">
            <img src={payment.proof_image_url} alt="Payment proof" />
            <span>Open full image</span>
          </a>
        ) : (
          <p className="panel-copy">No proof image.</p>
        )}
      </section>

      {isAdmin && pending ? (
        <section className="panel form-grid">
          <div className="panel-head full">
            <h3>Admin decision</h3>
          </div>
          <div className="ui-field full">
            <label htmlFor="reason">Reject reason (optional)</label>
            <input
              id="reason"
              className="ui-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="form-actions full">
            <Button type="button" disabled={saving} onClick={approve}>
              {saving
                ? 'Saving…'
                : pendingBatch.length > 1
                  ? `Approve all (${pendingBatch.length})`
                  : 'Approve & mark paid'}
            </Button>
            <Button type="button" variant="danger" disabled={saving} onClick={reject}>
              {pendingBatch.length > 1 ? `Reject all (${pendingBatch.length})` : 'Reject'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
