import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyItem = {
  name: '',
  category: 'kitchen',
  unit: 'kg',
  stock_qty: '',
  reorder_level: '10',
  unit_cost: '',
}

const emptyMove = {
  inventory_item_id: '',
  type: 'in',
  quantity: '',
  reference: '',
  notes: '',
}

export default function InventoryPage() {
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingMove, setSavingMove] = useState(false)
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [itemForm, setItemForm] = useState(emptyItem)
  const [moveForm, setMoveForm] = useState(emptyMove)

  function setItem(key, value) {
    setItemForm((prev) => ({ ...prev, [key]: value }))
  }

  function setMove(key, value) {
    setMoveForm((prev) => ({ ...prev, [key]: value }))
  }

  async function load() {
    setLoading(true)
    try {
      const [itemRes, moveRes] = await Promise.all([
        api('/inventory-items?status=active&per_page=50'),
        api('/inventory-movements?per_page=20'),
      ])
      setItems(itemRes.data || [])
      setMovements(moveRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAddItem(e) {
    e.preventDefault()
    setSavingItem(true)
    try {
      const data = await api('/inventory-items', {
        method: 'POST',
        body: {
          name: itemForm.name,
          category: itemForm.category,
          unit: itemForm.unit || 'unit',
          stock_qty: itemForm.stock_qty ? Number(itemForm.stock_qty) : 0,
          reorder_level: itemForm.reorder_level ? Number(itemForm.reorder_level) : 10,
          unit_cost: itemForm.unit_cost ? Number(itemForm.unit_cost) : 0,
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

  async function handleMove(e) {
    e.preventDefault()
    setSavingMove(true)
    try {
      const data = await api('/inventory-movements', {
        method: 'POST',
        body: {
          inventory_item_id: Number(moveForm.inventory_item_id),
          type: moveForm.type,
          quantity: Number(moveForm.quantity),
          reference: moveForm.reference || null,
          notes: moveForm.notes || null,
        },
      })
      toast.success(`${data.data.movement_code} recorded`)
      setMoveForm(emptyMove)
      load()
    } catch (err) {
      toast.error(err.message || 'Movement failed')
    } finally {
      setSavingMove(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Inventory & Stock</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleAddItem}>
            <div className="panel-head full">
              <h3>Add item</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={itemForm.name} onChange={(e) => setItem('name', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <select id="category" className="ui-select" value={itemForm.category} onChange={(e) => setItem('category', e.target.value)}>
                <option value="kitchen">Kitchen</option>
                <option value="general">General</option>
                <option value="cleaning">Cleaning</option>
                <option value="medical_supply">Medical supply</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="unit">Unit</label>
              <input id="unit" className="ui-input" value={itemForm.unit} onChange={(e) => setItem('unit', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_qty">Opening stock</label>
              <input id="stock_qty" className="ui-input" type="number" min="0" step="0.01" value={itemForm.stock_qty} onChange={(e) => setItem('stock_qty', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="unit_cost">Unit cost (PKR)</label>
              <input id="unit_cost" className="ui-input" type="number" min="0" step="0.01" value={itemForm.unit_cost} onChange={(e) => setItem('unit_cost', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingItem}>{savingItem ? 'Saving...' : 'Add item'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleMove}>
            <div className="panel-head full">
              <h3>Stock movement</h3>
            </div>
            <div className="ui-field">
              <label htmlFor="inventory_item_id">Item</label>
              <select id="inventory_item_id" className="ui-select" required value={moveForm.inventory_item_id} onChange={(e) => setMove('inventory_item_id', e.target.value)}>
                <option value="">Select item</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} · stock {i.stock_qty} {i.unit}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="type">Type</label>
              <select id="type" className="ui-select" value={moveForm.type} onChange={(e) => setMove('type', e.target.value)}>
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="adjust">Adjust to qty</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="quantity">Quantity</label>
              <input id="quantity" className="ui-input" type="number" min="0.01" step="0.01" required value={moveForm.quantity} onChange={(e) => setMove('quantity', e.target.value)} />
            </div>
            <div className="ui-field">
              <label htmlFor="reference">Reference</label>
              <input id="reference" className="ui-input" value={moveForm.reference} onChange={(e) => setMove('reference', e.target.value)} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingMove || !items.length}>{savingMove ? 'Saving...' : 'Record movement'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head">
              <h3>Stock list</h3>
            </div>
            {items.length === 0 ? (
              <p className="panel-copy">No inventory items yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.item_code}</td>
                        <td>{i.name}</td>
                        <td>{i.category}</td>
                        <td>
                          {i.stock_qty} {i.unit}
                          {i.low_stock ? <span className="badge"> low</span> : null}
                        </td>
                        <td>{formatPkr(i.unit_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Recent movements</h3>
            </div>
            {movements.length === 0 ? (
              <p className="panel-copy">No movements yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.movement_code}</td>
                        <td>{m.item?.name}</td>
                        <td><span className="badge">{m.type}</span></td>
                        <td>{m.quantity}</td>
                        <td>{m.moved_at}</td>
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
