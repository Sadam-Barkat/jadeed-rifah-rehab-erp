import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

const FORMS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'injection', label: 'Injection' },
  { value: 'drops', label: 'Drops' },
  { value: 'cream', label: 'Cream' },
  { value: 'ointment', label: 'Ointment' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'powder', label: 'Powder' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'other', label: 'Other' },
]

const UNITS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'ml', label: 'ml' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'strip', label: 'Strip' },
  { value: 'box', label: 'Box' },
  { value: 'vial', label: 'Vial' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'tube', label: 'Tube' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'unit', label: 'Unit' },
]

const emptyMed = {
  name: '',
  generic_name: '',
  form: 'tablet',
  strength: '',
  unit: 'tablet',
  manufacturer: '',
  stock_qty: '',
  reorder_level: '20',
  unit_price: '',
  batch_no: '',
  expiry_date: '',
  supplier: '',
  reference: '',
  notes: '',
}

const emptyStockIn = {
  medicine_id: '',
  quantity: '',
  batch_no: '',
  expiry_date: '',
  supplier: '',
  unit_cost: '',
  reference: '',
  notes: '',
}

const emptyDispense = {
  admission_id: '',
  medicine_id: '',
  quantity: '1',
  dosage: '',
  frequency: '',
  notes: '',
}

export default function PharmacyPage() {
  const { user } = useAuth()
  const canUsePharmacy = (user?.modules || []).includes('pharmacy')
  const [loading, setLoading] = useState(true)
  const [savingMed, setSavingMed] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [savingDispense, setSavingDispense] = useState(false)
  const [medicines, setMedicines] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [dispenses, setDispenses] = useState([])
  const [movements, setMovements] = useState([])
  const [staff, setStaff] = useState([])
  const [medForm, setMedForm] = useState(emptyMed)
  const [stockForm, setStockForm] = useState(emptyStockIn)
  const [dispenseForm, setDispenseForm] = useState(emptyDispense)
  const [medSearch, setMedSearch] = useState('')
  const [debouncedMedSearch, setDebouncedMedSearch] = useState('')
  const [medStaff, setMedStaff] = useState('')
  const [dispenseSearch, setDispenseSearch] = useState('')
  const [debouncedDispenseSearch, setDebouncedDispenseSearch] = useState('')
  const [dispenseStaff, setDispenseStaff] = useState('')
  const [moveStaff, setMoveStaff] = useState('')
  const [moveType, setMoveType] = useState('in')

  function setMed(key, value) {
    setMedForm((prev) => ({ ...prev, [key]: value }))
  }

  function setStock(key, value) {
    setStockForm((prev) => ({ ...prev, [key]: value }))
  }

  function setDisp(key, value) {
    setDispenseForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMedSearch(medSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [medSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDispenseSearch(dispenseSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [dispenseSearch])

  async function loadMedicines() {
    const q = new URLSearchParams({ status: 'active', per_page: '100' })
    if (debouncedMedSearch) q.set('search', debouncedMedSearch)
    if (medStaff) q.set('created_by', medStaff)
    const medRes = await api(`/medicines?${q}`)
    setMedicines(medRes.data || [])
    if (medRes.meta?.staff) setStaff(medRes.meta.staff)
  }

  async function loadDispenses() {
    const q = new URLSearchParams({ per_page: '50' })
    if (debouncedDispenseSearch) q.set('search', debouncedDispenseSearch)
    if (dispenseStaff) q.set('created_by', dispenseStaff)
    const dspRes = await api(`/medicine-dispenses?${q}`)
    setDispenses(dspRes.data || [])
  }

  async function loadMovements() {
    const q = new URLSearchParams({ per_page: '50', type: moveType || 'in' })
    if (moveStaff) q.set('created_by', moveStaff)
    const moveRes = await api(`/medicine-movements?${q}`)
    setMovements(moveRes.data || [])
    if (moveRes.meta?.staff) setStaff(moveRes.meta.staff)
  }

  async function load() {
    setLoading(true)
    try {
      const admRes = await api('/admissions?status=active&per_page=50')
      setAdmissions(admRes.data || [])
      await Promise.all([loadMedicines(), loadDispenses(), loadMovements()])
    } catch (err) {
      toast.error(err.message || 'Failed to load pharmacy data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canUsePharmacy) return
    load()
  }, [canUsePharmacy])

  useEffect(() => {
    if (!canUsePharmacy || loading) return
    loadMedicines().catch((err) => toast.error(err.message || 'Failed to filter medicines'))
  }, [debouncedMedSearch, medStaff])

  useEffect(() => {
    if (!canUsePharmacy || loading) return
    loadDispenses().catch((err) => toast.error(err.message || 'Failed to filter dispenses'))
  }, [debouncedDispenseSearch, dispenseStaff])

  useEffect(() => {
    if (!canUsePharmacy || loading) return
    loadMovements().catch((err) => toast.error(err.message || 'Failed to filter stock movements'))
  }, [moveStaff, moveType])

  const selectedStockMed = useMemo(
    () => medicines.find((m) => String(m.id) === String(stockForm.medicine_id)),
    [medicines, stockForm.medicine_id]
  )

  if (!canUsePharmacy) {
    return <Navigate to={homePathForUser(user)} replace />
  }

  async function handleAddMedicine(e) {
    e.preventDefault()
    setSavingMed(true)
    try {
      const data = await api('/medicines', {
        method: 'POST',
        body: {
          name: medForm.name,
          generic_name: medForm.generic_name || null,
          form: medForm.form,
          strength: medForm.strength || null,
          unit: medForm.unit,
          manufacturer: medForm.manufacturer || null,
          stock_qty: medForm.stock_qty ? Number(medForm.stock_qty) : 0,
          reorder_level: medForm.reorder_level ? Number(medForm.reorder_level) : 10,
          unit_price: medForm.unit_price ? Number(medForm.unit_price) : 0,
          batch_no: medForm.batch_no || null,
          expiry_date: medForm.expiry_date || null,
          supplier: medForm.supplier || null,
          reference: medForm.reference || null,
          notes: medForm.notes || null,
        },
      })
      toast.success(`${data.data.medicine_code} added`)
      setMedForm(emptyMed)
      await Promise.all([loadMedicines(), loadMovements()])
    } catch (err) {
      toast.error(err.message || 'Failed to add medicine')
    } finally {
      setSavingMed(false)
    }
  }

  async function handleStockIn(e) {
    e.preventDefault()
    setSavingStock(true)
    try {
      const data = await api('/medicine-movements', {
        method: 'POST',
        body: {
          medicine_id: Number(stockForm.medicine_id),
          type: 'in',
          quantity: Number(stockForm.quantity),
          batch_no: stockForm.batch_no || null,
          expiry_date: stockForm.expiry_date || null,
          supplier: stockForm.supplier || null,
          unit_cost: stockForm.unit_cost ? Number(stockForm.unit_cost) : null,
          reference: stockForm.reference || null,
          notes: stockForm.notes || null,
        },
      })
      toast.success(`${data.data.movement_code} stock in recorded`)
      setStockForm(emptyStockIn)
      await Promise.all([loadMedicines(), loadMovements()])
    } catch (err) {
      toast.error(err.message || 'Stock in failed')
    } finally {
      setSavingStock(false)
    }
  }

  async function handleDispense(e) {
    e.preventDefault()
    setSavingDispense(true)
    try {
      const data = await api('/medicine-dispenses', {
        method: 'POST',
        body: {
          admission_id: Number(dispenseForm.admission_id),
          medicine_id: Number(dispenseForm.medicine_id),
          quantity: Number(dispenseForm.quantity),
          dosage: dispenseForm.dosage || null,
          frequency: dispenseForm.frequency || null,
          notes: dispenseForm.notes || null,
        },
      })
      toast.success(`Dispensed ${data.data.dispense_code}`)
      setDispenseForm(emptyDispense)
      await Promise.all([loadMedicines(), loadDispenses()])
    } catch (err) {
      toast.error(err.message || 'Dispense failed')
    } finally {
      setSavingDispense(false)
    }
  }

  return (
    <div className="page print-page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Clinical Support</p>
          <h2>Pharmacy</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={() => window.print()} disabled={loading}>
            Print
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <header className="print-dash-head">
            <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
            <h2>Pharmacy — Medicine stock</h2>
          </header>

          <form className="panel form-grid no-print" onSubmit={handleAddMedicine}>
            <div className="panel-head full">
              <h3>New medicine (stock in)</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="name">Brand / trade name</label>
              <input id="name" className="ui-input" required value={medForm.name} onChange={(e) => setMed('name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="generic_name">Generic name</label>
              <input id="generic_name" className="ui-input" value={medForm.generic_name} onChange={(e) => setMed('generic_name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="form">Form</label>
              <select id="form" className="ui-select" required value={medForm.form} onChange={(e) => setMed('form', e.target.value)}>
                {FORMS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="strength">Strength</label>
              <input id="strength" className="ui-input" value={medForm.strength} onChange={(e) => setMed('strength', e.target.value)} placeholder="e.g. 500mg / 5ml" />
            </div>
            <div className="ui-field">
              <label htmlFor="unit">Unit</label>
              <select id="unit" className="ui-select" required value={medForm.unit} onChange={(e) => setMed('unit', e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="manufacturer">Manufacturer</label>
              <input id="manufacturer" className="ui-input" value={medForm.manufacturer} onChange={(e) => setMed('manufacturer', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_qty">Opening qty</label>
              <input id="stock_qty" className="ui-input" type="number" min="0" value={medForm.stock_qty} onChange={(e) => setMed('stock_qty', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="unit_price">Unit price (PKR)</label>
              <input id="unit_price" className="ui-input" type="number" min="0" step="0.01" value={medForm.unit_price} onChange={(e) => setMed('unit_price', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="batch_no">Batch no.</label>
              <input id="batch_no" className="ui-input" value={medForm.batch_no} onChange={(e) => setMed('batch_no', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="expiry_date">Expiry</label>
              <input id="expiry_date" className="ui-input" type="date" value={medForm.expiry_date} onChange={(e) => setMed('expiry_date', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="supplier">Supplier</label>
              <input id="supplier" className="ui-input" value={medForm.supplier} onChange={(e) => setMed('supplier', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="reorder_level">Reorder level</label>
              <input id="reorder_level" className="ui-input" type="number" min="0" value={medForm.reorder_level} onChange={(e) => setMed('reorder_level', e.target.value)} />
            </div>
            <div className="ui-field">
              <label>Recorded by</label>
              <input className="ui-input" value={user?.name || '—'} readOnly />
            </div>
            <div className="ui-field full">
              <label htmlFor="med_notes">Notes</label>
              <input id="med_notes" className="ui-input" value={medForm.notes} onChange={(e) => setMed('notes', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingMed}>{savingMed ? 'Saving...' : 'Add medicine'}</Button>
            </div>
          </form>

          <form className="panel form-grid no-print" onSubmit={handleStockIn}>
            <div className="panel-head full">
              <h3>Stock in (existing medicine)</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="stock_medicine_id">Medicine</label>
              <select id="stock_medicine_id" className="ui-select" required value={stockForm.medicine_id} onChange={(e) => setStock('medicine_id', e.target.value)}>
                <option value="">Select medicine</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.strength || m.form} · stock {m.stock_qty} {m.unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="stock_quantity">Quantity {selectedStockMed?.unit ? `(${selectedStockMed.unit})` : ''}</label>
              <input id="stock_quantity" className="ui-input" type="number" min="1" required value={stockForm.quantity} onChange={(e) => setStock('quantity', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_batch">Batch no.</label>
              <input id="stock_batch" className="ui-input" value={stockForm.batch_no} onChange={(e) => setStock('batch_no', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_expiry">Expiry</label>
              <input id="stock_expiry" className="ui-input" type="date" value={stockForm.expiry_date} onChange={(e) => setStock('expiry_date', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_supplier">Supplier</label>
              <input id="stock_supplier" className="ui-input" value={stockForm.supplier} onChange={(e) => setStock('supplier', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_unit_cost">Unit cost (PKR)</label>
              <input id="stock_unit_cost" className="ui-input" type="number" min="0" step="0.01" value={stockForm.unit_cost} onChange={(e) => setStock('unit_cost', e.target.value)} />
            </div>
            <div className="ui-field">
              <label>Recorded by</label>
              <input className="ui-input" value={user?.name || '—'} readOnly />
            </div>
            <div className="ui-field full">
              <label htmlFor="stock_notes">Notes</label>
              <input id="stock_notes" className="ui-input" value={stockForm.notes} onChange={(e) => setStock('notes', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingStock || !medicines.length}>{savingStock ? 'Saving...' : 'Record stock in'}</Button>
            </div>
          </form>

          <form className="panel form-grid no-print" onSubmit={handleDispense}>
            <div className="panel-head full">
              <h3>Dispense to patient (stock out)</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="admission_id">Active admission</label>
              <select id="admission_id" className="ui-select" required value={dispenseForm.admission_id} onChange={(e) => setDisp('admission_id', e.target.value)}>
                <option value="">Select admission</option>
                {admissions.map((a) => (
                  <option key={a.id} value={a.id}>{a.admission_code} · {a.patient?.full_name}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="medicine_id">Medicine</label>
              <select id="medicine_id" className="ui-select" required value={dispenseForm.medicine_id} onChange={(e) => setDisp('medicine_id', e.target.value)}>
                <option value="">Select medicine</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.strength || m.unit}) · stock {m.stock_qty}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="quantity">Quantity</label>
              <input id="quantity" className="ui-input" type="number" min="1" required value={dispenseForm.quantity} onChange={(e) => setDisp('quantity', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="dosage">Dosage</label>
              <input id="dosage" className="ui-input" value={dispenseForm.dosage} onChange={(e) => setDisp('dosage', e.target.value)} placeholder="e.g. 1 tablet" />
            </div>
            <div className="ui-field">
              <label htmlFor="frequency">Frequency</label>
              <input id="frequency" className="ui-input" value={dispenseForm.frequency} onChange={(e) => setDisp('frequency', e.target.value)} placeholder="e.g. BD / TDS" />
            </div>
            <div className="ui-field">
              <label>Dispensed by</label>
              <input className="ui-input" value={user?.name || '—'} readOnly />
            </div>
            <div className="ui-field full">
              <label htmlFor="notes">Notes</label>
              <input id="notes" className="ui-input" value={dispenseForm.notes} onChange={(e) => setDisp('notes', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingDispense || !admissions.length || !medicines.length}>
                {savingDispense ? 'Saving...' : 'Dispense'}
              </Button>
            </div>
          </form>

          <section className="panel print-stock-panel">
            <div className="panel-head">
              <h3>Medicine stock</h3>
            </div>
            <div className="list-toolbar no-print">
              <input
                className="ui-input"
                type="search"
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
                placeholder="Search medicine"
                aria-label="Search medicines"
              />
              <select className="ui-select" value={medStaff} onChange={(e) => setMedStaff(e.target.value)} aria-label="Staff filter">
                <option value="">All staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {medicines.length === 0 ? (
              <p className="panel-copy">No medicines in store.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel print-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Form</th>
                      <th>Strength</th>
                      <th>Stock</th>
                      <th>Price</th>
                      <th>Added by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((m) => (
                      <tr key={m.id}>
                        <td>{m.medicine_code}</td>
                        <td>{m.name}</td>
                        <td>{m.form || '—'}</td>
                        <td>{m.strength || '—'}</td>
                        <td>
                          {m.stock_qty} {m.unit}
                          {m.low_stock ? <span className="badge badge-warn"> low</span> : null}
                        </td>
                        <td>{formatPkr(m.unit_price)}</td>
                        <td>{m.recorded_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel no-print">
            <div className="panel-head">
              <h3>Stock in history</h3>
            </div>
            <div className="list-toolbar">
              <select className="ui-select" value={moveType} onChange={(e) => setMoveType(e.target.value)} aria-label="Movement type">
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="adjust">Adjust</option>
              </select>
              <select className="ui-select" value={moveStaff} onChange={(e) => setMoveStaff(e.target.value)} aria-label="Staff filter">
                <option value="">All staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {movements.length === 0 ? (
              <p className="panel-copy">No movements yet.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Medicine</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Batch</th>
                      <th>By</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.movement_code}</td>
                        <td>{m.medicine?.name}</td>
                        <td><span className="badge">{m.type}</span></td>
                        <td>{m.quantity}</td>
                        <td>{m.batch_no || '—'}</td>
                        <td>{m.recorded_by || '—'}</td>
                        <td>{m.moved_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel no-print">
            <div className="panel-head">
              <h3>Patient dispenses</h3>
            </div>
            <div className="list-toolbar">
              <input
                className="ui-input"
                type="search"
                value={dispenseSearch}
                onChange={(e) => setDispenseSearch(e.target.value)}
                placeholder="Search patient / medicine"
                aria-label="Search dispenses"
              />
              <select className="ui-select" value={dispenseStaff} onChange={(e) => setDispenseStaff(e.target.value)} aria-label="Staff filter">
                <option value="">All staff</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {dispenses.length === 0 ? (
              <p className="panel-copy">No dispenses yet.</p>
            ) : (
              <div className="scroll-panel dash-scroll-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Medicine</th>
                      <th>Qty</th>
                      <th>By</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispenses.map((d) => (
                      <tr key={d.id}>
                        <td>{d.dispense_code}</td>
                        <td>{d.patient?.patient_code} · {d.patient?.full_name}</td>
                        <td>{d.medicine?.name}</td>
                        <td>{d.quantity}</td>
                        <td>{d.recorded_by || '—'}</td>
                        <td>{d.dispensed_at}</td>
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
