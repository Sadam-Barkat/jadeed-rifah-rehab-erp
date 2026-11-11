import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyMed = {
  name: '',
  generic_name: '',
  form: '',
  strength: '',
  unit: 'tablet',
  stock_qty: '',
  reorder_level: '20',
  unit_price: '',
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
  const [loading, setLoading] = useState(true)
  const [savingMed, setSavingMed] = useState(false)
  const [savingDispense, setSavingDispense] = useState(false)
  const [medicines, setMedicines] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [dispenses, setDispenses] = useState([])
  const [medForm, setMedForm] = useState(emptyMed)
  const [dispenseForm, setDispenseForm] = useState(emptyDispense)

  function setMed(key, value) {
    setMedForm((prev) => ({ ...prev, [key]: value }))
  }

  function setDisp(key, value) {
    setDispenseForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [medRes, admRes, dspRes] = await Promise.all([
        api('/medicines?status=active&per_page=50'),
        api('/admissions?status=active&per_page=50'),
        api('/medicine-dispenses?per_page=20'),
      ])
      setMedicines(medRes.data || [])
      setAdmissions(admRes.data || [])
      setDispenses(dspRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load pharmacy data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAddMedicine(e) {
    e.preventDefault()
    setSavingMed(true)
    try {
      const data = await api('/medicines', {
        method: 'POST',
        body: {
          name: medForm.name,
          generic_name: medForm.generic_name || null,
          form: medForm.form || null,
          strength: medForm.strength || null,
          unit: medForm.unit || 'unit',
          stock_qty: medForm.stock_qty ? Number(medForm.stock_qty) : 0,
          reorder_level: medForm.reorder_level ? Number(medForm.reorder_level) : 10,
          unit_price: medForm.unit_price ? Number(medForm.unit_price) : 0,
        },
      })
      toast.success(`${data.data.medicine_code} added`)
      setMedForm(emptyMed)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to add medicine')
    } finally {
      setSavingMed(false)
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
      load()
    } catch (err) {
      toast.error(err.message || 'Dispense failed')
    } finally {
      setSavingDispense(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Clinical Support</p>
          <h2>Pharmacy & Medicine Store</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleAddMedicine}>
            <div className="panel-head full">
              <h3>Add medicine</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={medForm.name} onChange={(e) => setMed('name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="generic_name">Generic</label>
              <input id="generic_name" className="ui-input" value={medForm.generic_name} onChange={(e) => setMed('generic_name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="form">Form</label>
              <input id="form" className="ui-input" value={medForm.form} onChange={(e) => setMed('form', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="strength">Strength</label>
              <input id="strength" className="ui-input" value={medForm.strength} onChange={(e) => setMed('strength', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_qty">Stock</label>
              <input id="stock_qty" className="ui-input" type="number" min="0" value={medForm.stock_qty} onChange={(e) => setMed('stock_qty', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="unit_price">Unit price (PKR)</label>
              <input id="unit_price" className="ui-input" type="number" min="0" step="0.01" value={medForm.unit_price} onChange={(e) => setMed('unit_price', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingMed}>{savingMed ? 'Saving...' : 'Add medicine'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleDispense}>
            <div className="panel-head full">
              <h3>Dispense medicine</h3>
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
              <input id="dosage" className="ui-input" value={dispenseForm.dosage} onChange={(e) => setDisp('dosage', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="frequency">Frequency</label>
              <input id="frequency" className="ui-input" value={dispenseForm.frequency} onChange={(e) => setDisp('frequency', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="notes">Notes</label>
              <input id="notes" className="ui-input" value={dispenseForm.notes} onChange={(e) => setDisp('notes', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingDispense || !admissions.length || !medicines.length}>
                {savingDispense ? 'Saving...' : 'Dispense'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Stock</h3>
            </div>
            {medicines.length === 0 ? (
              <p className="panel-copy">No medicines in store.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Strength</th>
                      <th>Stock</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((m) => (
                      <tr key={m.id}>
                        <td>{m.medicine_code}</td>
                        <td>{m.name}</td>
                        <td>{m.strength || '—'}</td>
                        <td>
                          {m.stock_qty}
                          {m.low_stock ? <span className="badge"> low</span> : null}
                        </td>
                        <td>PKR {Number(m.unit_price || 0).toLocaleString('en-PK')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent dispenses</h3>
            </div>
            {dispenses.length === 0 ? (
              <p className="panel-copy">No dispenses yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Patient</th>
                      <th>Medicine</th>
                      <th>Qty</th>
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
