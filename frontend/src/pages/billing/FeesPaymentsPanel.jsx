import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { SkeletonCards } from '../../components/ui/Skeleton'

const FEES_TABS = [
  { id: 'create', label: 'Create Invoice' },
  { id: 'awaiting', label: 'Awaiting plan' },
  { id: 'pending', label: 'Payment pending' },
  { id: 'cleared', label: 'Cleared' },
]

const VALID_FEES = new Set(FEES_TABS.map((t) => t.id))
const CARD_PAGE_SIZE = 12
const SEARCHABLE_TABS = new Set(['awaiting', 'pending', 'cleared'])

const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'bank', label: 'Bank' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'Easypaisa' },
]

const emptyCreate = {
  admission_id: '',
  discount: '0',
  mode: 'full',
  installment_count: '2',
  notes: '',
}

const emptyPayment = {
  method: 'cash',
  notes: '',
  proof_image: null,
}

function evenSplit(total, count) {
  const n = Math.max(1, Number(count) || 1)
  const t = Math.round(Number(total) * 100) / 100
  const base = Math.round((t / n) * 100) / 100
  const amounts = Array.from({ length: n }, () => base)
  const sum = amounts.reduce((a, b) => a + b, 0)
  amounts[n - 1] = Math.round((amounts[n - 1] + (t - sum)) * 100) / 100
  return amounts
}

function collectionOf(inv) {
  return inv.collection_status || (inv.status === 'paid' || Number(inv.balance) <= 0 ? 'paid' : 'due')
}

function groupByPatient(invoiceList) {
  const map = new Map()
  for (const inv of invoiceList) {
    const key = String(inv.patient?.id || inv.admission?.id || inv.id)
    if (!map.has(key)) {
      map.set(key, {
        key,
        patient: inv.patient || {},
        admission: inv.admission || {},
        invoices: [],
      })
    }
    map.get(key).invoices.push(inv)
  }
  return Array.from(map.values()).map((g) => {
    const invoices = [...g.invoices].sort(
      (a, b) => Number(a.installment_no || 1) - Number(b.installment_no || 1)
    )
    const balance = invoices.reduce((s, i) => s + Number(i.balance || 0), 0)
    const paid = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0)
    const paidCount = invoices.filter((i) => collectionOf(i) === 'paid').length
    const awaitingCount = invoices.filter((i) => collectionOf(i) === 'awaiting_approval').length
    const dueCount = invoices.filter((i) => collectionOf(i) === 'due').length
    return {
      ...g,
      invoices,
      balance,
      paid,
      paidCount,
      awaitingCount,
      dueCount,
      invoiceCount: invoices.length,
      package_name: invoices[0]?.package_name?.replace(/\s*\(\d+\/\d+\)\s*$/, '') || '—',
      progressLabel: `${paidCount}/${invoices.length} paid`,
    }
  })
}

function paginate(list, page, size = CARD_PAGE_SIZE) {
  const total = list.length
  const lastPage = Math.max(1, Math.ceil(total / size) || 1)
  const current = Math.min(Math.max(1, page), lastPage)
  const start = (current - 1) * size
  return {
    rows: list.slice(start, start + size),
    page: current,
    lastPage,
    total,
  }
}

export default function FeesPaymentsPanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFees = searchParams.get('fees') || 'create'
  const feesTab = rawFees === 'collect' ? 'pending' : VALID_FEES.has(rawFees) ? rawFees : 'create'

  function setFeesTab(id) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'fees')
    if (id === 'create') next.delete('fees')
    else next.set('fees', id)
    setSearchParams(next, { replace: true })
  }

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [needing, setNeeding] = useState([])
  const [plans, setPlans] = useState([])
  const [invoices, setInvoices] = useState([])
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [splitAmounts, setSplitAmounts] = useState([])
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [detailGroup, setDetailGroup] = useState(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payOptions, setPayOptions] = useState([])
  const [selectedPayIds, setSelectedPayIds] = useState([])

  function setCreate(key, value) {
    setCreateForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPay(key, value) {
    setPaymentForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setDetailGroup(null)
  }, [feesTab])

  async function loadTab() {
    setLoading(true)
    try {
      if (feesTab === 'create') {
        const needRes = await api('/invoices/needing')
        setNeeding(needRes.data || [])
      } else if (feesTab === 'awaiting') {
        const q = new URLSearchParams({ status: 'pending', per_page: '50' })
        if (debouncedSearch) q.set('search', debouncedSearch)
        const res = await api(`/fee-plans?${q}`)
        setPlans(res.data || [])
      } else if (feesTab === 'pending') {
        const q = new URLSearchParams({ fee_progress: '1', per_page: '50' })
        if (debouncedSearch) q.set('search', debouncedSearch)
        const res = await api(`/invoices?${q}`)
        setInvoices(res.data || [])
      } else if (feesTab === 'cleared') {
        const q = new URLSearchParams({ status: 'paid', per_page: '50' })
        if (debouncedSearch) q.set('search', debouncedSearch)
        const [paidRes, unpaidRes] = await Promise.all([
          api(`/invoices?${q}`),
          api('/invoices?status=unpaid&per_page=50'),
        ])
        const unpaidIds = new Set(
          (unpaidRes.data || [])
            .filter((i) => Number(i.balance) > 0)
            .map((i) => String(i.patient?.id || ''))
            .filter(Boolean)
        )
        setInvoices(
          (paidRes.data || []).filter((i) => !unpaidIds.has(String(i.patient?.id || '')))
        )
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load fees data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTab()
  }, [feesTab, debouncedSearch])

  const selectedAdmission = useMemo(
    () => needing.find((a) => String(a.id) === String(createForm.admission_id)),
    [needing, createForm.admission_id]
  )

  const maxInstallments = selectedAdmission?.max_installments || 1
  const canRequestInstallments = maxInstallments >= 2

  const packageTotal = useMemo(() => {
    const amount = Number(selectedAdmission?.package_amount || 0)
    const discount = Number(createForm.discount || 0)
    return Math.max(0, Math.round((amount - discount) * 100) / 100)
  }, [selectedAdmission, createForm.discount])

  useEffect(() => {
    if (createForm.mode !== 'installments' || packageTotal <= 0) {
      setSplitAmounts([])
      return
    }
    const count = Math.min(maxInstallments, Math.max(2, Number(createForm.installment_count) || 2))
    setSplitAmounts(evenSplit(packageTotal, count))
  }, [createForm.mode, createForm.installment_count, packageTotal, maxInstallments])

  useEffect(() => {
    if (!selectedAdmission) return
    if (maxInstallments < 2 && createForm.mode === 'installments') {
      setCreate('mode', 'full')
    }
    const count = Number(createForm.installment_count)
    if (count > maxInstallments) {
      setCreate('installment_count', String(Math.max(2, maxInstallments)))
    }
  }, [selectedAdmission, maxInstallments])

  const patientGroups = useMemo(() => groupByPatient(invoices), [invoices])
  const pendingGroups = useMemo(
    () => patientGroups.filter((g) => g.dueCount > 0 || g.awaitingCount > 0),
    [patientGroups]
  )

  const awaitingPage = useMemo(() => paginate(plans, page), [plans, page])
  const pendingPage = useMemo(() => paginate(pendingGroups, page), [pendingGroups, page])
  const clearedPage = useMemo(() => paginate(patientGroups, page), [patientGroups, page])

  function openPay(inv, group = detailGroup) {
    const dueList = (group?.invoices || []).filter((row) => collectionOf(row) === 'due')
    const options = dueList.length > 0 ? dueList : inv ? [inv] : []
    if (options.length === 0) {
      toast.error('No due invoices to pay')
      return
    }
    setPayOptions(options)
    setSelectedPayIds([Number(inv?.id || options[0].id)])
    setPaymentForm({ ...emptyPayment })
    setPayOpen(true)
  }

  function togglePayInvoice(id) {
    const num = Number(id)
    setSelectedPayIds((prev) => {
      if (prev.includes(num)) {
        if (prev.length === 1) return prev
        return prev.filter((x) => x !== num)
      }
      return [...prev, num]
    })
  }

  const selectedPayInvoices = useMemo(
    () => payOptions.filter((inv) => selectedPayIds.includes(Number(inv.id))),
    [payOptions, selectedPayIds]
  )
  const selectedPayTotal = useMemo(
    () => selectedPayInvoices.reduce((s, inv) => s + Number(inv.balance || 0), 0),
    [selectedPayInvoices]
  )

  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.admission_id) {
      toast.error('Select an admitted patient')
      return
    }
    if (!selectedAdmission?.fee_package_id && !selectedAdmission?.package_amount) {
      toast.error('No fee package found for this patient plan')
      return
    }
    setSaving(true)
    try {
      const bodyBase = {
        admission_id: Number(createForm.admission_id),
        fee_package_id: selectedAdmission.fee_package_id
          ? Number(selectedAdmission.fee_package_id)
          : null,
        discount: Number(createForm.discount || 0),
        notes: createForm.notes || null,
      }
      if (createForm.mode === 'installments') {
        const count = Math.min(maxInstallments, Math.max(2, Number(createForm.installment_count) || 2))
        const amounts = splitAmounts.length === count ? splitAmounts : evenSplit(packageTotal, count)
        const data = await api('/fee-plans', {
          method: 'POST',
          body: {
            ...bodyBase,
            installment_count: count,
            installment_amounts: amounts,
          },
        })
        toast.success(data.message || 'Installment request sent')
        setCreateForm(emptyCreate)
        setFeesTab('awaiting')
      } else {
        const data = await api('/invoices', {
          method: 'POST',
          body: bodyBase,
        })
        toast.success(`Invoice ${data.data.invoice_code} created`)
        setCreateForm(emptyCreate)
        setFeesTab('pending')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handlePayment(e) {
    e.preventDefault()
    if (selectedPayIds.length === 0) {
      toast.error('Select at least one invoice')
      return
    }
    if (!paymentForm.proof_image) {
      toast.error('Payment proof image is required')
      return
    }
    if (paymentForm.proof_image.size > 40 * 1024 * 1024) {
      toast.error('Payment proof must be 40 MB or smaller.')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      selectedPayIds.forEach((id) => fd.append('invoice_ids[]', String(id)))
      fd.append('method', paymentForm.method)
      if (paymentForm.notes) fd.append('notes', paymentForm.notes)
      fd.append('proof_image', paymentForm.proof_image)

      const data = await api('/payments', { method: 'POST', body: fd })
      toast.success(data.message || 'Sent for admin approval')
      setPaymentForm(emptyPayment)
      setPayOptions([])
      setSelectedPayIds([])
      setPayOpen(false)
      setDetailGroup(null)
      await loadTab()
    } catch (err) {
      toast.error(err.message || 'Payment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fees-panel">
      <div className="filter-tabs no-print" role="tablist" aria-label="Fees & payments steps">
        {FEES_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`filter-tab ${feesTab === tab.id ? 'is-active' : ''}`}
            aria-selected={feesTab === tab.id}
            onClick={() => setFeesTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {SEARCHABLE_TABS.has(feesTab) ? (
        <div className="list-toolbar no-print">
          <input
            type="search"
            className="ui-input"
            placeholder="Search patient / code"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            aria-label="Search fees"
          />
        </div>
      ) : null}

      {loading ? (
        <SkeletonCards count={4} />
      ) : feesTab === 'create' ? (
        <form className="panel form-grid" onSubmit={handleCreate}>
          <div className="panel-head full">
            <h3>Create Invoice</h3>
          </div>
          <div className="ui-field">
            <label htmlFor="fee_admission">Admission</label>
            <select
              id="fee_admission"
              className="ui-select"
              required
              value={createForm.admission_id}
              onChange={(e) => setCreate('admission_id', e.target.value)}
            >
              <option value="">Select admitted patient</option>
              {needing.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.admission_code} · {a.patient?.full_name} · {a.program_days}d
                </option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label htmlFor="fee_plan_view">Patient plan</label>
            <input
              id="fee_plan_view"
              className="ui-input"
              readOnly
              value={
                selectedAdmission
                  ? `${selectedAdmission.package_name || `${selectedAdmission.program_days}-Day Program`} · ${formatPkr(selectedAdmission.package_amount || 0)}`
                  : '—'
              }
            />
          </div>
          <div className="ui-field">
            <label htmlFor="fee_discount">Discount (PKR)</label>
            <input
              id="fee_discount"
              className="ui-input"
              type="number"
              min="0"
              value={createForm.discount}
              onChange={(e) => setCreate('discount', e.target.value)}
            />
          </div>
          <div className="ui-field">
            <label htmlFor="fee_mode">Billing</label>
            <select
              id="fee_mode"
              className="ui-select"
              value={createForm.mode}
              onChange={(e) => setCreate('mode', e.target.value)}
            >
              <option value="full">Single invoice (default)</option>
              {canRequestInstallments ? (
                <option value="installments">Request installments (admin approve)</option>
              ) : null}
            </select>
          </div>
          {createForm.mode === 'installments' ? (
            <>
              <div className="ui-field">
                <label htmlFor="fee_inst_count">Installments</label>
                <select
                  id="fee_inst_count"
                  className="ui-select"
                  value={createForm.installment_count}
                  onChange={(e) => setCreate('installment_count', e.target.value)}
                >
                  {Array.from({ length: maxInstallments - 1 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={String(n)}>
                      {n} invoices (monthly)
                    </option>
                  ))}
                </select>
              </div>
              {splitAmounts.map((amt, idx) => (
                <div className="ui-field" key={`split-${idx}`}>
                  <label htmlFor={`fee_split_${idx}`}>Invoice {idx + 1} (PKR)</label>
                  <input
                    id={`fee_split_${idx}`}
                    className="ui-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={String(amt)}
                    onChange={(e) => {
                      const next = [...splitAmounts]
                      next[idx] = Number(e.target.value || 0)
                      setSplitAmounts(next)
                    }}
                  />
                </div>
              ))}
            </>
          ) : null}
          <div className="ui-field full">
            <label htmlFor="fee_notes">Notes</label>
            <input
              id="fee_notes"
              className="ui-input"
              value={createForm.notes}
              onChange={(e) => setCreate('notes', e.target.value)}
            />
          </div>
          <div className="form-actions full">
            <Button type="submit" disabled={saving || !needing.length}>
              {saving
                ? 'Saving…'
                : createForm.mode === 'installments'
                  ? 'Send installment request'
                  : 'Create invoice'}
            </Button>
          </div>
          {!needing.length ? (
            <p className="panel-copy full">No admitted patients need an invoice.</p>
          ) : null}
        </form>
      ) : feesTab === 'awaiting' ? (
        <>
          {awaitingPage.total === 0 ? (
            <section className="panel">
              <p className="panel-copy">No pending installment requests.</p>
            </section>
          ) : (
            <div className="entity-card-grid">
              {awaitingPage.rows.map((p) => (
                <article key={p.id} className="entity-card">
                  <div className="entity-card-top">
                    <div>
                      <p className="entity-card-code">{p.plan_code}</p>
                      <h3>{p.patient?.full_name || 'Patient'}</h3>
                    </div>
                    <span className="badge">{p.status}</span>
                  </div>
                  <dl className="entity-card-meta">
                    <div>
                      <dt>Total</dt>
                      <dd>{formatPkr(p.total_amount)}</dd>
                    </div>
                    <div>
                      <dt>Invoices</dt>
                      <dd>{p.installment_count}</dd>
                    </div>
                    <div>
                      <dt>Split</dt>
                      <dd>
                        {(p.installment_amounts || []).map((a) => formatPkr(a)).join(' / ') || '—'}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
          {awaitingPage.total > 0 ? (
            <Pagination
              page={awaitingPage.page}
              lastPage={awaitingPage.lastPage}
              disabled={loading}
              onChange={setPage}
            />
          ) : null}
        </>
      ) : feesTab === 'pending' ? (
        <>
          {pendingPage.total === 0 ? (
            <section className="panel">
              <p className="panel-copy">No patients waiting for payment.</p>
            </section>
          ) : (
            <div className="entity-card-grid">
              {pendingPage.rows.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className="entity-card fees-click-card"
                  onClick={() => setDetailGroup(g)}
                >
                  <div className="entity-card-top">
                    <div>
                      <p className="entity-card-code">{g.patient?.patient_code || '—'}</p>
                      <h3>{g.patient?.full_name || 'Patient'}</h3>
                    </div>
                    <span className="badge">{g.progressLabel}</span>
                  </div>
                  <dl className="entity-card-meta">
                    <div>
                      <dt>Due balance</dt>
                      <dd>{formatPkr(g.balance)}</dd>
                    </div>
                    <div>
                      <dt>Package</dt>
                      <dd>{g.package_name}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {g.awaitingCount > 0
                          ? `${g.awaitingCount} awaiting`
                          : g.dueCount > 0
                            ? `${g.dueCount} due`
                            : 'Clear'}
                      </dd>
                    </div>
                  </dl>
                  <span className="fees-card-hint">View invoices</span>
                </button>
              ))}
            </div>
          )}
          {pendingPage.total > 0 ? (
            <Pagination
              page={pendingPage.page}
              lastPage={pendingPage.lastPage}
              disabled={loading}
              onChange={setPage}
            />
          ) : null}
        </>
      ) : (
        <>
          {clearedPage.total === 0 ? (
            <section className="panel">
              <p className="panel-copy">No fully cleared patients yet.</p>
            </section>
          ) : (
            <div className="entity-card-grid">
              {clearedPage.rows.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className="entity-card fees-click-card"
                  onClick={() => setDetailGroup(g)}
                >
                  <div className="entity-card-top">
                    <div>
                      <p className="entity-card-code">{g.patient?.patient_code || '—'}</p>
                      <h3>{g.patient?.full_name || 'Patient'}</h3>
                    </div>
                    <span className="badge">Paid</span>
                  </div>
                  <dl className="entity-card-meta">
                    <div>
                      <dt>Paid</dt>
                      <dd>{formatPkr(g.paid)}</dd>
                    </div>
                    <div>
                      <dt>Invoices</dt>
                      <dd>{g.invoiceCount}</dd>
                    </div>
                    <div>
                      <dt>Package</dt>
                      <dd>{g.package_name}</dd>
                    </div>
                  </dl>
                  <span className="fees-card-hint">View invoices</span>
                </button>
              ))}
            </div>
          )}
          {clearedPage.total > 0 ? (
            <Pagination
              page={clearedPage.page}
              lastPage={clearedPage.lastPage}
              disabled={loading}
              onChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={Boolean(detailGroup)}
        title={detailGroup?.patient?.full_name || 'Invoices'}
        onClose={() => setDetailGroup(null)}
        hideFooter
        size="sm"
      >
        {detailGroup ? (
          <div className="fees-installment-list">
            <p className="panel-copy">
              {detailGroup.patient?.patient_code} · {detailGroup.progressLabel || `${detailGroup.invoiceCount} invoices`}
            </p>
            {detailGroup.invoices.map((inv) => {
              const status = collectionOf(inv)
              const label =
                inv.collection_status_label ||
                (status === 'paid' ? 'Paid' : status === 'awaiting_approval' ? 'Awaiting approval' : 'Due')
              return (
                <div key={inv.id} className="fees-installment-row">
                  <div>
                    <strong>
                      Invoice #{inv.installment_no || 1} · {inv.invoice_code}
                    </strong>
                    <span>
                      {status === 'paid'
                        ? `Paid ${formatPkr(inv.paid_amount || inv.total_amount)}`
                        : `${formatPkr(inv.balance)} · due ${inv.due_date || '—'}`}
                    </span>
                  </div>
                  <div className="fees-installment-actions">
                    <span className={`fee-status fee-status-${status}`}>{label}</span>
                    {feesTab === 'pending' && status === 'due' ? (
                      <Button type="button" size="sm" onClick={() => openPay(inv)}>
                        Pay
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={payOpen}
        title="Collect payment"
        onClose={() => {
          setPayOpen(false)
          setPayOptions([])
          setSelectedPayIds([])
          setPaymentForm(emptyPayment)
        }}
        hideFooter
      >
        <form className="form-grid" onSubmit={handlePayment}>
          <div className="ui-field full">
            <label>Invoices</label>
            <div className="fees-pay-invoice-list">
              {payOptions.map((inv) => {
                const checked = selectedPayIds.includes(Number(inv.id))
                return (
                  <label key={inv.id} className={`fees-pay-invoice-row ${checked ? 'is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePayInvoice(inv.id)}
                    />
                    <span>
                      <strong>
                        Invoice #{inv.installment_no || 1} · {inv.invoice_code}
                      </strong>
                      <em>{formatPkr(inv.balance)}</em>
                    </span>
                  </label>
                )
              })}
            </div>
            {payOptions.length > 1 ? (
              <div className="fees-pay-select-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedPayIds(payOptions.map((inv) => Number(inv.id)))}
                >
                  Select all
                </Button>
              </div>
            ) : null}
          </div>
          <div className="ui-field">
            <label>Amount (PKR)</label>
            <div className="ui-input is-locked" aria-readonly="true">
              {formatPkr(selectedPayTotal)}
              {selectedPayInvoices.length > 1 ? ` · ${selectedPayInvoices.length} invoices` : ''}
            </div>
          </div>
          <div className="ui-field">
            <label htmlFor="pay_method">Method</label>
            <select
              id="pay_method"
              className="ui-select"
              value={paymentForm.method}
              onChange={(e) => setPay('method', e.target.value)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label htmlFor="pay_proof">
              {paymentForm.method === 'cash' ? 'Cash proof image' : 'Payment screenshot'}
            </label>
            <input
              id="pay_proof"
              className="ui-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file && file.size > 40 * 1024 * 1024) {
                  toast.error('Payment proof must be 40 MB or smaller.')
                  e.target.value = ''
                  setPay('proof_image', null)
                  return
                }
                setPay('proof_image', file)
              }}
            />
          </div>
          <div className="ui-field">
            <label htmlFor="pay_notes">Notes</label>
            <input
              id="pay_notes"
              className="ui-input"
              value={paymentForm.notes}
              onChange={(e) => setPay('notes', e.target.value)}
            />
          </div>
          <div className="form-actions full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPayOpen(false)
                setPayOptions([])
                setSelectedPayIds([])
                setPaymentForm(emptyPayment)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !paymentForm.proof_image || selectedPayIds.length === 0}
            >
              {saving ? 'Sending…' : 'Send for admin approval'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
