import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'
import '../pages.css'

function evenSplit(total, count) {
  const n = Math.max(1, Number(count) || 1)
  const t = Math.round(Number(total) * 100) / 100
  const base = Math.round((t / n) * 100) / 100
  const amounts = Array.from({ length: n }, () => base)
  const sum = amounts.reduce((a, b) => a + b, 0)
  amounts[n - 1] = Math.round((amounts[n - 1] + (t - sum)) * 100) / 100
  return amounts
}

export default function FeePlanApprovalPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role_slug === 'admin'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState(null)
  const [discount, setDiscount] = useState('0')
  const [reason, setReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await api(`/fee-plans/${id}`)
      const row = data.data
      setPlan(row)
      setDiscount(String(Number(row?.discount || 0)))
    } catch (err) {
      toast.error(err.message || 'Failed to load plan')
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const preview = useMemo(() => {
    if (!plan) return null
    const amount = Number(plan.amount || 0)
    const d = Math.max(0, Number(discount || 0))
    const total = Math.max(0, Math.round((amount - d) * 100) / 100)
    const parts = evenSplit(total, plan.installment_count || 1)
    return { amount, discount: d, total, parts }
  }, [plan, discount])

  async function approve() {
    if (!plan || !preview) return
    if (preview.discount > Number(plan.amount || 0)) {
      toast.error('Discount cannot exceed package amount')
      return
    }
    if (preview.total <= 0) {
      toast.error('Total after discount must be greater than zero')
      return
    }
    setSaving(true)
    try {
      const data = await api(`/fee-plans/${id}/approve`, {
        method: 'POST',
        body: {
          discount: preview.discount,
          installment_amounts: preview.parts,
        },
      })
      toast.success(data.message || 'Plan approved')
      setPlan(data.data)
    } catch (err) {
      toast.error(err.message || 'Approve failed')
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    setSaving(true)
    try {
      const data = await api(`/fee-plans/${id}/reject`, {
        method: 'POST',
        body: { reason: reason || null },
      })
      toast.success(data.message || 'Plan rejected')
      setPlan(data.data)
    } catch (err) {
      toast.error(err.message || 'Reject failed')
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

  if (!plan) {
    return (
      <div className="page">
        <p className="panel-copy">Plan not found.</p>
        <Link className="ui-btn ui-btn-back ui-btn-md" to={isAdmin ? '/app/admin/finance' : '/app/billing?tab=fees&fees=awaiting'}>
          Back
        </Link>
      </div>
    )
  }

  const pending = plan.status === 'pending'
  const partsLabel = (plan.installment_amounts || []).map((a) => formatPkr(a)).join(' / ')
  const backTo = isAdmin ? '/app/admin/finance' : '/app/billing?tab=fees&fees=awaiting'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Installment plan</p>
          <h2>{plan.plan_code}</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="back" onClick={() => navigate(backTo)}>
            Back
          </Button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Request</h3>
          <span className="badge">{plan.status}</span>
        </div>
        <div className="detail-grid">
          <div>
            <span>Patient</span>
            <strong>
              {plan.patient?.patient_code} · {plan.patient?.full_name}
            </strong>
          </div>
          <div>
            <span>Admission</span>
            <strong>{plan.admission?.admission_code || '—'}</strong>
          </div>
          <div>
            <span>Package</span>
            <strong>{plan.package_name || '—'}</strong>
          </div>
          <div>
            <span>Program</span>
            <strong>{plan.program_days ? `${plan.program_days} days` : '—'}</strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>{formatPkr(plan.amount)}</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>{formatPkr(plan.discount || 0)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatPkr(plan.total_amount)}</strong>
          </div>
          <div>
            <span>Invoices</span>
            <strong>
              {plan.installment_count}
              {partsLabel ? ` · ${partsLabel}` : ''}
            </strong>
          </div>
          <div>
            <span>Requested by</span>
            <strong>{plan.requested_by_name || '—'}</strong>
          </div>
          {plan.reviewed_by_name ? (
            <div>
              <span>Reviewed by</span>
              <strong>{plan.reviewed_by_name}</strong>
            </div>
          ) : null}
          {plan.notes ? (
            <div className="full">
              <span>Notes</span>
              <strong>{plan.notes}</strong>
            </div>
          ) : null}
          {plan.rejection_reason ? (
            <div className="full">
              <span>Rejection reason</span>
              <strong>{plan.rejection_reason}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {Array.isArray(plan.invoices) && plan.invoices.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Created invoices</h3>
          </div>
          <div className="fees-installment-list">
            {plan.invoices.map((inv) => (
              <div key={inv.id} className="fees-installment-row">
                <div>
                  <strong>
                    Invoice #{inv.installment_no || 1} · {inv.invoice_code}
                  </strong>
                  <span>{formatPkr(inv.total_amount)}</span>
                </div>
                <span className="badge">{inv.status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isAdmin && pending ? (
        <section className="panel form-grid">
          <div className="panel-head full">
            <h3>Admin decision</h3>
          </div>
          <div className="ui-field">
            <label htmlFor="plan_discount">Discount (PKR)</label>
            <div className="fees-installment-actions">
              <input
                id="plan_discount"
                className="ui-input"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => setDiscount('0')}>
                Clear discount
              </Button>
            </div>
          </div>
          {preview ? (
            <p className="panel-copy full">
              Total {formatPkr(preview.total)} · {preview.parts.map((a) => formatPkr(a)).join(' / ')}
            </p>
          ) : null}
          <div className="ui-field full">
            <label htmlFor="plan_reject_reason">Reject reason (optional)</label>
            <input
              id="plan_reject_reason"
              className="ui-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="form-actions full">
            <Button type="button" disabled={saving} onClick={approve}>
              {saving ? 'Saving…' : 'Approve'}
            </Button>
            <Button type="button" variant="danger" disabled={saving} onClick={reject}>
              Reject
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
