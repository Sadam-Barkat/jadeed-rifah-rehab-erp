import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { medicineExpiryInfo } from '../../lib/format'
import { clearDraft, loadDraft, saveDraft } from '../../lib/pharmacyDrafts'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import WhenToGiveField from '../../components/ui/WhenToGiveField'
import MedicinePicker from '../../components/pharmacy/MedicinePicker'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

const emptyLine = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  medicine_id: '',
  medicine_label: '',
  dispensed_qty: '1',
  dosage: '',
  frequency: '',
  instructions: '',
  stock_qty: null,
  unit: '',
  low_stock: false,
  expiry_date: null,
})

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

/** Red only when out of stock or qty > available. */
function stockStatus(line) {
  if (!line.medicine_id) return null
  if (line.stock_qty == null || line.stock_qty === '') return null
  const stock = Number(line.stock_qty)
  const qty = Number(line.dispensed_qty || 0)
  if (stock <= 0) return 'out'
  if (qty > stock) return 'short'
  return 'ok'
}

function mapRxItem(item) {
  const stock = item.medicine?.stock_qty
  const name = item.medicine_name || item.medicine?.name || ''
  const fullyExpired = !!item.medicine?.is_expired
  return {
    key: `item-${item.id}`,
    id: item.id,
    // Fully expired stock is not recommended — dispenser must pick current stock.
    medicine_id: fullyExpired ? '' : (item.medicine_id ? String(item.medicine_id) : ''),
    medicine_label: fullyExpired
      ? `${name} · expired — pick current stock`
      : name,
    dispensed_qty: String(item.quantity || 1),
    dosage: item.dosage || '',
    frequency: item.frequency || '',
    instructions: item.instructions || '',
    stock_qty: fullyExpired ? null : (stock == null ? null : Number(stock)),
    unit: item.medicine?.unit || '',
    low_stock: !!item.medicine?.low_stock,
    expiry_date: fullyExpired ? null : (item.medicine?.expiry_date || null),
    needs_stock_pick: fullyExpired,
  }
}

export default function PharmacyFulfillPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const openDraft = searchParams.get('draft') === '1'
  const navigate = useNavigate()
  const { user } = useAuth()
  const canUsePharmacy = (user?.modules || []).includes('pharmacy')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rx, setRx] = useState(null)
  const [lines, setLines] = useState([emptyLine()])
  const [activeKey, setActiveKey] = useState(null)
  const [draftReady, setDraftReady] = useState(false)
  const [dirty, setDirty] = useState(false)
  const draftKey = `fulfill_${id}`

  function persistDraft(nextLines = lines) {
    if (!rx) return
    saveDraft(draftKey, {
      lines: nextLines,
      prescription_code: rx.prescription_code,
      patient_name: rx.patient?.full_name || '',
    })
  }

  useEffect(() => {
    if (!canUsePharmacy || !id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setDraftReady(false)
      setDirty(false)
      try {
        const res = await api(`/medicine-prescriptions/${id}`)
        if (cancelled) return
        const data = res.data
        setRx(data)
        if (data.status !== 'pending') {
          clearDraft(draftKey)
          toast.error('This prescription is already done')
          navigate('/app/pharmacy?tab=prescriptions')
          return
        }

        const draft = openDraft ? loadDraft(draftKey) : null
        if (openDraft && draft?.lines?.length) {
          setLines(draft.lines)
          setActiveKey(draft.lines[0]?.key || null)
          toast.message('Draft opened')
        } else if (data.items?.length) {
          const mapped = data.items.map(mapRxItem)
          setLines(mapped)
          setActiveKey(mapped[0]?.key || null)
        } else {
          const first = emptyLine()
          setLines([first])
          setActiveKey(first.key)
        }
      } catch (err) {
        toast.error(err.message || 'Failed to load prescription')
        navigate('/app/pharmacy?tab=prescriptions')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setDraftReady(true)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [canUsePharmacy, id, openDraft])

  useEffect(() => {
    if (!rx || loading || !draftReady || !dirty) return undefined
    const t = setTimeout(() => {
      persistDraft(lines)
    }, 400)
    return () => clearTimeout(t)
  }, [lines, rx, loading, draftReady, dirty, draftKey])

  if (!canUsePharmacy) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  function updateLine(key, patch) {
    setDirty(true)
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function addLine() {
    setDirty(true)
    const row = emptyLine()
    setLines((prev) => [...prev, row])
    setActiveKey(row.key)
  }

  function removeLine(key) {
    setDirty(true)
    setLines((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((row) => row.key !== key)
      if (activeKey === key) setActiveKey(next[0]?.key || null)
      return next
    })
  }

  function pickMedicine(med) {
    if (!activeLine) return
    const stock = Number(med.stock_qty || 0)
    updateLine(activeLine.key, {
      medicine_id: String(med.id),
      medicine_label: `${med.name}${med.strength ? ` · ${med.strength}` : ''}`,
      stock_qty: stock,
      unit: med.unit || '',
      low_stock: !!med.low_stock,
      expiry_date: med.expiry_date || null,
      is_expired: !!med.is_expired,
      needs_stock_pick: false,
      dispensed_qty: String(activeLine.dispensed_qty || 1),
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rx) return

    for (const line of lines) {
      if (!line.medicine_id) continue
      const expired = medicineExpiryInfo(line.expiry_date)
      if (expired || line.is_expired) {
        toast.error(`${line.medicine_label || 'Medicine'}: ${expired?.label || 'Medicine expired'}`)
        setActiveKey(line.key)
        return
      }
      const status = stockStatus(line)
      if (status === 'out') {
        toast.error(`${line.medicine_label || 'Medicine'} is out of stock. Available: 0`)
        setActiveKey(line.key)
        return
      }
      if (status === 'short') {
        toast.error(
          `${line.medicine_label || 'Medicine'}: need ${line.dispensed_qty}, available ${line.stock_qty}`
        )
        setActiveKey(line.key)
        return
      }
    }

    const items = lines
      .filter((line) => line.medicine_id && Number(line.dispensed_qty) > 0)
      .map((line) => ({
        id: line.id || undefined,
        medicine_id: Number(line.medicine_id),
        dispensed_qty: Number(line.dispensed_qty),
        dosage: line.dosage || null,
        frequency: line.frequency || null,
        instructions: line.instructions || null,
      }))

    if (!items.length) {
      toast.error('Add at least one medicine from stock')
      return
    }

    setSaving(true)
    try {
      const body = {
        items,
        print_slip: true,
      }
      if (rx.admission_id || rx.admission?.id) {
        body.admission_id = Number(rx.admission_id || rx.admission.id)
      }
      const data = await api(`/medicine-prescriptions/${rx.id}/dispense`, {
        method: 'POST',
        body,
      })
      clearDraft(draftKey)
      setDirty(false)
      toast.success(`${data.data.prescription_code} done · nurse notified`)
      navigate(`/app/medicine-slips/${rx.id}?autoprint=1`)
    } catch (err) {
      toast.error(err.message || 'Failed to record medicines')
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (dirty) persistDraft(lines)
    navigate(openDraft ? '/app/pharmacy?tab=drafts' : '/app/pharmacy?tab=prescriptions')
  }

  const activeLine = lines.find((line) => line.key === activeKey) || lines[0]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dispenser</p>
          <h2>{openDraft ? 'Fulfill draft' : 'Fulfill prescription'}</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="ghost" onClick={handleBack}>
            Back
          </Button>
        </div>
      </div>

      {loading || !rx ? (
        <SkeletonCards count={2} />
      ) : (
        <form className="pharmacy-fulfill-layout" onSubmit={handleSubmit}>
          <section className="panel">
            <div className="panel-head"><h3>{rx.prescription_code}</h3></div>
            <dl className="rx-meta-list">
              <div className="rx-meta-row">
                <dt>Patient</dt>
                <dd>
                  {rx.patient?.full_name || '—'}
                  {rx.patient?.patient_code ? ` · ${rx.patient.patient_code}` : ''}
                </dd>
              </div>
              <div className="rx-meta-row">
                <dt>Doctor</dt>
                <dd>{rx.doctor?.full_name || rx.prescribed_by || '—'}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Specialty</dt>
                <dd>{rx.doctor?.specialization || rx.doctor_specialization || '—'}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Nurse</dt>
                <dd>{rx.nurse?.name || '—'}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Prescribed</dt>
                <dd>{formatWhen(rx.prescribed_at)}</dd>
              </div>
            </dl>
            {rx.handwritten_image_url ? (
              <div className="rx-hw-image">
                <img src={rx.handwritten_image_url} alt="Handwritten prescription" />
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Medicines to dispense</h3>
              <Button type="button" variant="secondary" onClick={addLine}>Add medicine</Button>
            </div>

            <div className="rx-lines-scroll pharmacy-fulfill-lines">
              {lines.map((line, index) => {
                const status = stockStatus(line)
                const danger = status === 'out' || status === 'short'
                const expired = medicineExpiryInfo(line.expiry_date)
                return (
                  <div
                    key={line.key}
                    className={`rx-line-card${activeKey === line.key ? ' is-active-card' : ''}${danger ? ' is-stock-danger' : ''}${!danger && expired ? ' is-expiry-danger' : ''}`}
                    onClick={() => setActiveKey(line.key)}
                  >
                    <div className="rx-line-card-head">
                      <strong>Medicine {index + 1}</strong>
                      <Button type="button" variant="ghost" disabled={lines.length <= 1} onClick={() => removeLine(line.key)}>
                        Delete
                      </Button>
                    </div>
                    <div className="form-grid">
                      <div className="ui-field full">
                        <label>Selected stock</label>
                        <input
                          className="ui-input"
                          readOnly
                          value={line.medicine_label || 'Pick from category / form list →'}
                        />
                        {line.medicine_id && line.stock_qty != null ? (
                          <p className={`stock-avail-note${danger ? ' is-danger' : ''}`}>
                            {Number(line.stock_qty) <= 0
                              ? 'Available: 0 · Out of stock'
                              : `Available: ${line.stock_qty} ${line.unit || ''}`.trim()}
                            {status === 'short' ? ` · prescription qty ${line.dispensed_qty}` : ''}
                          </p>
                        ) : null}
                        {line.needs_stock_pick && !line.medicine_id ? (
                          <p className="stock-avail-note is-expiry">Expired stock removed — pick current stock</p>
                        ) : null}
                        {expired ? (
                          <p className="stock-avail-note is-expiry">{expired.label}</p>
                        ) : null}
                      </div>
                      <div className="ui-field">
                        <label>Qty</label>
                        <input
                          className="ui-input"
                          type="number"
                          min="1"
                          required
                          value={line.dispensed_qty}
                          onChange={(e) => updateLine(line.key, { dispensed_qty: e.target.value })}
                        />
                      </div>
                      <div className="ui-field">
                        <label>Dosage</label>
                        <input
                          className="ui-input"
                          value={line.dosage}
                          onChange={(e) => updateLine(line.key, { dosage: e.target.value })}
                        />
                      </div>
                      <div className="ui-field full">
                        <label>When to give</label>
                        <WhenToGiveField
                          id={`fulfill_freq_${line.key}`}
                          value={line.frequency}
                          onChange={(value) => updateLine(line.key, { frequency: value })}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="form-actions" style={{ marginTop: 12 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  persistDraft(lines)
                  setDirty(false)
                  toast.success('Draft updated')
                }}
              >
                Save draft
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Submit & mark done'}
              </Button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Pick stock · line {Math.max(1, lines.findIndex((l) => l.key === activeLine?.key) + 1)}</h3>
            </div>
            <MedicinePicker
              selectedId={activeLine?.medicine_id || ''}
              onSelect={pickMedicine}
            />
          </section>
        </form>
      )}
    </div>
  )
}
