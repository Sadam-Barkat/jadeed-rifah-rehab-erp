import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyProduct = { name: '', unit_price: '', stock_qty: '' }
const emptySale = { canteen_product_id: '', quantity: '1', customer_name: '', payment_method: 'cash' }

export default function CanteenPage() {
  const [loading, setLoading] = useState(true)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingSale, setSavingSale] = useState(false)
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [productForm, setProductForm] = useState(emptyProduct)
  const [saleForm, setSaleForm] = useState(emptySale)

  async function load() {
    setLoading(true)
    try {
      const [prodRes, saleRes] = await Promise.all([
        api('/canteen-products?status=active'),
        api('/canteen-sales?per_page=20'),
      ])
      setProducts(prodRes.data || [])
      setSales(saleRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load canteen data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleProduct(e) {
    e.preventDefault()
    setSavingProduct(true)
    try {
      const data = await api('/canteen-products', {
        method: 'POST',
        body: {
          name: productForm.name,
          unit_price: Number(productForm.unit_price),
          stock_qty: productForm.stock_qty ? Number(productForm.stock_qty) : 0,
        },
      })
      toast.success(`${data.data.product_code} added`)
      setProductForm(emptyProduct)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to add product')
    } finally {
      setSavingProduct(false)
    }
  }

  async function handleSale(e) {
    e.preventDefault()
    setSavingSale(true)
    try {
      const data = await api('/canteen-sales', {
        method: 'POST',
        body: {
          customer_name: saleForm.customer_name || null,
          payment_method: saleForm.payment_method,
          items: [
            {
              canteen_product_id: Number(saleForm.canteen_product_id),
              quantity: Number(saleForm.quantity),
            },
          ],
        },
      })
      toast.success(`${data.data.sale_code} · ${formatPkr(data.data.total_amount)}`)
      setSaleForm(emptySale)
      load()
    } catch (err) {
      toast.error(err.message || 'Sale failed')
    } finally {
      setSavingSale(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Canteen Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleProduct}>
            <div className="panel-head full"><h3>Add product</h3></div>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="unit_price">Price (PKR)</label>
              <input id="unit_price" className="ui-input" type="number" min="0" step="0.01" required value={productForm.unit_price} onChange={(e) => setProductForm((p) => ({ ...p, unit_price: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="stock_qty">Stock</label>
              <input id="stock_qty" className="ui-input" type="number" min="0" value={productForm.stock_qty} onChange={(e) => setProductForm((p) => ({ ...p, stock_qty: e.target.value }))} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingProduct}>{savingProduct ? 'Saving...' : 'Add product'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleSale}>
            <div className="panel-head full"><h3>Record sale</h3></div>
            <div className="ui-field">
              <label htmlFor="canteen_product_id">Product</label>
              <select id="canteen_product_id" className="ui-select" required value={saleForm.canteen_product_id} onChange={(e) => setSaleForm((p) => ({ ...p, canteen_product_id: e.target.value }))}>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {formatPkr(p.unit_price)} · stock {p.stock_qty}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="quantity">Quantity</label>
              <input id="quantity" className="ui-input" type="number" min="1" required value={saleForm.quantity} onChange={(e) => setSaleForm((p) => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="customer_name">Customer</label>
              <input id="customer_name" className="ui-input" value={saleForm.customer_name} onChange={(e) => setSaleForm((p) => ({ ...p, customer_name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="payment_method">Payment</label>
              <select id="payment_method" className="ui-select" value={saleForm.payment_method} onChange={(e) => setSaleForm((p) => ({ ...p, payment_method: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingSale || !products.length}>{savingSale ? 'Saving...' : 'Record sale'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Products</h3></div>
            {products.length === 0 ? (
              <p className="panel-copy">No canteen products yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.product_code}</td>
                        <td>{p.name}</td>
                        <td>{formatPkr(p.unit_price)}</td>
                        <td>{p.stock_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Recent sales</h3></div>
            {sales.length === 0 ? (
              <p className="panel-copy">No sales yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Method</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id}>
                        <td>{s.sale_code}</td>
                        <td>{s.customer_name || '—'}</td>
                        <td>{formatPkr(s.total_amount)}</td>
                        <td>{s.payment_method}</td>
                        <td>{s.sold_at}</td>
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
