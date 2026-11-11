import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  type: 'expense',
  category: 'utilities',
  amount: '',
  payment_method: 'cash',
  reference: '',
  description: '',
  entry_date: new Date().toISOString().slice(0, 10),
}

export default function AccountsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [voidingId, setVoidingId] = useState(null)
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [form, setForm] = useState(emptyForm)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const res = await api('/account-entries?per_page=30')
      setEntries(res.data || [])
      setSummary(res.summary || { income: 0, expense: 0, balance: 0 })
    } catch (err) {
      toast.error(err.message || 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await api('/account-entries', {
        method: 'POST',
        body: {
          type: form.type,
          category: form.category,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          reference: form.reference || null,
          description: form.description || null,
          entry_date: form.entry_date || null,
        },
      })
      toast.success(`${data.data.entry_code} posted`)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to post entry')
    } finally {
      setSaving(false)
    }
  }

  async function voidEntry(entry) {
    setVoidingId(entry.id)
    try {
      const data = await api(`/account-entries/${entry.id}/void`, { method: 'POST', body: {} })
      toast.success(`${data.data.entry_code} voided`)
      load()
    } catch (err) {
      toast.error(err.message || 'Void failed')
    } finally {
      setVoidingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h2>Accounts & Finance</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <section className="panel form-grid">
            <div className="ui-field">
              <label>Income</label>
              <div className="ui-input" style={{ display: 'flex', alignItems: 'center' }}>{formatPkr(summary.income)}</div>
            </div>
            <div className="ui-field">
              <label>Expense</label>
              <div className="ui-input" style={{ display: 'flex', alignItems: 'center' }}>{formatPkr(summary.expense)}</div>
            </div>
            <div className="ui-field">
              <label>Balance</label>
              <div className="ui-input" style={{ display: 'flex', alignItems: 'center' }}>{formatPkr(summary.balance)}</div>
            </div>
          </section>

          <form className="panel form-grid" onSubmit={handleSubmit}>
            <div className="panel-head full"><h3>Post entry</h3></div>
            <div className="ui-field">
              <label htmlFor="type">Type</label>
              <select id="type" className="ui-select" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <select id="category" className="ui-select" value={form.category} onChange={(e) => setField('category', e.target.value)}>
                <option value="fee_collection">Fee collection</option>
                <option value="purchase">Purchase</option>
                <option value="salary">Salary</option>
                <option value="utilities">Utilities</option>
                <option value="maintenance">Maintenance</option>
                <option value="canteen">Canteen</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="amount">Amount (PKR)</label>
              <input id="amount" className="ui-input" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setField('amount', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="payment_method">Method</label>
              <select id="payment_method" className="ui-select" value={form.payment_method} onChange={(e) => setField('payment_method', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="entry_date">Date</label>
              <input id="entry_date" className="ui-input" type="date" value={form.entry_date} onChange={(e) => setField('entry_date', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="reference">Reference</label>
              <input id="reference" className="ui-input" value={form.reference} onChange={(e) => setField('reference', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="description">Description</label>
              <input id="description" className="ui-input" value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Post entry'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Ledger</h3></div>
            {entries.length === 0 ? (
              <p className="panel-copy">No account entries yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td>{e.entry_code}</td>
                        <td>{e.entry_date}</td>
                        <td><span className="badge">{e.type}</span></td>
                        <td>{e.category}</td>
                        <td>{formatPkr(e.amount)}</td>
                        <td>
                          {e.status === 'posted' ? (
                            <Button type="button" variant="secondary" disabled={voidingId === e.id} onClick={() => voidEntry(e)}>
                              Void
                            </Button>
                          ) : e.status}
                        </td>
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
