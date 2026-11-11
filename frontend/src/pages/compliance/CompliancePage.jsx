import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const FRAMEWORKS = [
  { value: 'phc', label: 'PHC' },
  { value: 'msds', label: 'MSDS' },
  { value: 'internal', label: 'Internal' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'as_needed', label: 'As needed' },
]

const RESULTS = [
  { value: 'pass', label: 'Pass' },
  { value: 'partial', label: 'Partial' },
  { value: 'fail', label: 'Fail' },
  { value: 'na', label: 'N/A' },
]

const emptyItem = {
  framework: 'phc',
  category: '',
  title: '',
  frequency: 'monthly',
}

const emptyCheck = {
  compliance_item_id: '',
  result: 'pass',
  evidence_note: '',
  action_required: '',
  next_due_on: '',
}

export default function CompliancePage() {
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingCheck, setSavingCheck] = useState(false)
  const [items, setItems] = useState([])
  const [checks, setChecks] = useState([])
  const [itemForm, setItemForm] = useState(emptyItem)
  const [checkForm, setCheckForm] = useState(emptyCheck)

  function setItemField(key, value) {
    setItemForm((prev) => ({ ...prev, [key]: value }))
  }

  function setCheckField(key, value) {
    setCheckForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [itemRes, checkRes] = await Promise.all([
        api('/compliance-items?status=active&per_page=50'),
        api('/compliance-checks?per_page=20'),
      ])
      setItems(itemRes.data || [])
      setChecks(checkRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load compliance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleItemSubmit(e) {
    e.preventDefault()
    setSavingItem(true)
    try {
      const data = await api('/compliance-items', {
        method: 'POST',
        body: {
          framework: itemForm.framework,
          category: itemForm.category || null,
          title: itemForm.title,
          frequency: itemForm.frequency,
        },
      })
      toast.success(`${data.data.item_code} added`)
      setItemForm(emptyItem)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to add item')
    } finally {
      setSavingItem(false)
    }
  }

  async function handleCheckSubmit(e) {
    e.preventDefault()
    setSavingCheck(true)
    try {
      const data = await api('/compliance-checks', {
        method: 'POST',
        body: {
          compliance_item_id: Number(checkForm.compliance_item_id),
          result: checkForm.result,
          evidence_note: checkForm.evidence_note || null,
          action_required: checkForm.action_required || null,
          next_due_on: checkForm.next_due_on || null,
        },
      })
      toast.success(`${data.data.check_code} recorded`)
      setCheckForm(emptyCheck)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to record check')
    } finally {
      setSavingCheck(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Compliance</p>
          <h2>PHC & MSDS Compliance</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleItemSubmit}>
            <div className="ui-field">
              <label htmlFor="framework">Framework</label>
              <select id="framework" className="ui-select" value={itemForm.framework} onChange={(e) => setItemField('framework', e.target.value)}>
                {FRAMEWORKS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <input id="category" className="ui-input" value={itemForm.category} onChange={(e) => setItemField('category', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="frequency">Frequency</label>
              <select id="frequency" className="ui-select" value={itemForm.frequency} onChange={(e) => setItemField('frequency', e.target.value)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field full">
              <label htmlFor="title">Checklist item</label>
              <input id="title" className="ui-input" required value={itemForm.title} onChange={(e) => setItemField('title', e.target.value)} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingItem}>{savingItem ? 'Saving…' : 'Add item'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleCheckSubmit}>
            <div className="ui-field">
              <label htmlFor="compliance_item_id">Item</label>
              <select id="compliance_item_id" className="ui-select" required value={checkForm.compliance_item_id} onChange={(e) => setCheckField('compliance_item_id', e.target.value)}>
                <option value="">Select</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.item_code} — {i.title}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="result">Result</label>
              <select id="result" className="ui-select" value={checkForm.result} onChange={(e) => setCheckField('result', e.target.value)}>
                {RESULTS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="next_due_on">Next due</label>
              <input id="next_due_on" type="date" className="ui-input" value={checkForm.next_due_on} onChange={(e) => setCheckField('next_due_on', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="evidence_note">Evidence</label>
              <input id="evidence_note" className="ui-input" value={checkForm.evidence_note} onChange={(e) => setCheckField('evidence_note', e.target.value)} />
            </div>
            <div className="ui-field full">
              <label htmlFor="action_required">Action required</label>
              <textarea id="action_required" className="ui-textarea" rows={2} value={checkForm.action_required} onChange={(e) => setCheckField('action_required', e.target.value)} />
            </div>
            <div className="ui-field full actions">
              <Button type="submit" disabled={savingCheck}>{savingCheck ? 'Saving…' : 'Record check'}</Button>
            </div>
          </form>

          <div className="panel">
            <h3>Checklist</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Framework</th>
                    <th>Category</th>
                    <th>Title</th>
                    <th>Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5}>No items</td></tr>
                  ) : items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.item_code}</td>
                      <td>{i.framework.toUpperCase()}</td>
                      <td>{i.category || '—'}</td>
                      <td>{i.title}</td>
                      <td>{i.frequency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h3>Recent checks</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Item</th>
                    <th>Result</th>
                    <th>Date</th>
                    <th>Next due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.length === 0 ? (
                    <tr><td colSpan={6}>No checks</td></tr>
                  ) : checks.map((c) => (
                    <tr key={c.id}>
                      <td>{c.check_code}</td>
                      <td>{c.item?.title || '—'}</td>
                      <td>{c.result}</td>
                      <td>{c.checked_on || '—'}</td>
                      <td>{c.next_due_on || '—'}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
