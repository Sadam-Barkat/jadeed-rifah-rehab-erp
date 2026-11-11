import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptySupplier = { name: '', contact_person: '', phone: '', address: '' }
const emptyPo = { supplier_id: '', inventory_item_id: '', quantity: '1', unit_price: '', notes: '' }

export default function PurchasePage() {
  const [loading, setLoading] = useState(true)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [savingPo, setSavingPo] = useState(false)
  const [receivingId, setReceivingId] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [supplierForm, setSupplierForm] = useState(emptySupplier)
  const [poForm, setPoForm] = useState(emptyPo)

  async function load() {
    setLoading(true)
    try {
      const [supRes, invRes, poRes] = await Promise.all([
        api('/suppliers?status=active'),
        api('/inventory-items?status=active&per_page=50'),
        api('/purchase-orders?per_page=20'),
      ])
      setSuppliers(supRes.data || [])
      setInventory(invRes.data || [])
      setOrders(poRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load purchase data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSupplier(e) {
    e.preventDefault()
    setSavingSupplier(true)
    try {
      const data = await api('/suppliers', {
        method: 'POST',
        body: {
          name: supplierForm.name,
          contact_person: supplierForm.contact_person || null,
          phone: supplierForm.phone || null,
          address: supplierForm.address || null,
        },
      })
      toast.success(`${data.data.supplier_code} added`)
      setSupplierForm(emptySupplier)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to add supplier')
    } finally {
      setSavingSupplier(false)
    }
  }

  async function handlePo(e) {
    e.preventDefault()
    setSavingPo(true)
    try {
      const inv = inventory.find((i) => String(i.id) === String(poForm.inventory_item_id))
      const data = await api('/purchase-orders', {
        method: 'POST',
        body: {
          supplier_id: Number(poForm.supplier_id),
          notes: poForm.notes || null,
          items: [
            {
              inventory_item_id: Number(poForm.inventory_item_id),
              item_name: inv?.name,
              unit: inv?.unit,
              quantity: Number(poForm.quantity),
              unit_price: Number(poForm.unit_price),
            },
          ],
        },
      })
      toast.success(`${data.data.po_code} created`)
      setPoForm(emptyPo)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to create PO')
    } finally {
      setSavingPo(false)
    }
  }

  async function receivePo(po) {
    setReceivingId(po.id)
    try {
      const data = await api(`/purchase-orders/${po.id}/receive`, { method: 'POST', body: {} })
      toast.success(`${data.data.po_code} received`)
      load()
    } catch (err) {
      toast.error(err.message || 'Receive failed')
    } finally {
      setReceivingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h2>Purchase & Suppliers</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleSupplier}>
            <div className="panel-head full"><h3>Add supplier</h3></div>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="contact_person">Contact person</label>
              <input id="contact_person" className="ui-input" value={supplierForm.contact_person} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_person: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" className="ui-input" value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="address">Address</label>
              <input id="address" className="ui-input" value={supplierForm.address} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingSupplier}>{savingSupplier ? 'Saving...' : 'Add supplier'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handlePo}>
            <div className="panel-head full"><h3>Create purchase order</h3></div>
            <div className="ui-field">
              <label htmlFor="supplier_id">Supplier</label>
              <select id="supplier_id" className="ui-select" required value={poForm.supplier_id} onChange={(e) => setPoForm((p) => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplier_code} · {s.name}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="inventory_item_id">Inventory item</label>
              <select id="inventory_item_id" className="ui-select" required value={poForm.inventory_item_id} onChange={(e) => setPoForm((p) => ({ ...p, inventory_item_id: e.target.value }))}>
                <option value="">Select item</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} · stock {i.stock_qty}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="quantity">Quantity</label>
              <input id="quantity" className="ui-input" type="number" min="0.01" step="0.01" required value={poForm.quantity} onChange={(e) => setPoForm((p) => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="unit_price">Unit price (PKR)</label>
              <input id="unit_price" className="ui-input" type="number" min="0" step="0.01" required value={poForm.unit_price} onChange={(e) => setPoForm((p) => ({ ...p, unit_price: e.target.value }))} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingPo || !suppliers.length || !inventory.length}>
                {savingPo ? 'Saving...' : 'Create PO'}
              </Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Purchase orders</h3></div>
            {orders.length === 0 ? (
              <p className="panel-copy">No purchase orders yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Supplier</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((po) => (
                      <tr key={po.id}>
                        <td>{po.po_code}</td>
                        <td>{po.supplier?.name}</td>
                        <td>{formatPkr(po.total_amount)}</td>
                        <td><span className="badge">{po.status}</span></td>
                        <td>
                          {po.status === 'ordered' ? (
                            <Button type="button" variant="secondary" disabled={receivingId === po.id} onClick={() => receivePo(po)}>
                              Receive
                            </Button>
                          ) : (po.received_at || '—')}
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
