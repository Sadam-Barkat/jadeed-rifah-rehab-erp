import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatPkrExact } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

export default function InventoryReceiptPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isAdmin = ['admin', 'owner'].includes(user?.role_slug)

  useEffect(() => {
    let active = true
    async function loadReceipt() {
      setLoading(true)
      setError('')
      try {
        const response = await api(`/notifications/stock-receipts/${id}`)
        if (active) setReceipt(response.data)
      } catch (err) {
        if (active) {
          setReceipt(null)
          setError(err.message || 'Could not load this stock receipt.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    if (isAdmin) loadReceipt()
    return () => {
      active = false
    }
  }, [id, isAdmin])

  if (!isAdmin) return <Navigate to="/app" replace />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Inventory notification</p>
          <h2>{receipt?.item?.name || 'Stock received'}</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : error ? (
        <section className="panel">
          <p className="panel-copy">{error}</p>
        </section>
      ) : receipt ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h3>Stock receipt details</h3>
              <span className="badge">Stock in</span>
            </div>
            <div className="detail-grid">
              <div>
                <span>Item</span>
                <strong>{receipt.item?.name || '—'}</strong>
              </div>
              <div>
                <span>Item code</span>
                <strong>{receipt.item?.item_code || '—'}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{receipt.item?.category || '—'}</strong>
              </div>
              <div>
                <span>Movement code</span>
                <strong>{receipt.movement_code || '—'}</strong>
              </div>
              <div>
                <span>Quantity received</span>
                <strong>{Number(receipt.quantity || 0).toLocaleString('en-PK')} {receipt.unit}</strong>
              </div>
              <div>
                <span>Purchase price per {receipt.unit}</span>
                <strong>{formatPkrExact(receipt.unit_cost)}</strong>
              </div>
              <div>
                <span>Total purchase cost</span>
                <strong>{formatPkrExact(receipt.total_cost)}</strong>
              </div>
              <div>
                <span>Supplier / received from</span>
                <strong>{receipt.supplier || '—'}</strong>
              </div>
              <div>
                <span>Received date</span>
                <strong>{receipt.received_at || '—'}</strong>
              </div>
              <div>
                <span>Recorded by</span>
                <strong>{receipt.recorded_by || '—'}</strong>
              </div>
              {receipt.notes ? (
                <div className="full">
                  <span>Notes</span>
                  <strong>{receipt.notes}</strong>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Bill / receipt</h3>
              {receipt.bill_image_url ? (
                <a
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                  href={receipt.bill_image_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View full-size bill
                </a>
              ) : null}
            </div>
            {receipt.bill_image_url ? (
              <div className="inventory-receipt-proof">
                {receipt.bill_image_type === 'application/pdf' ? (
                  <iframe
                    src={receipt.bill_image_url}
                    title="Uploaded stock bill"
                    className="inventory-receipt-pdf"
                  />
                ) : (
                  <img
                    src={receipt.bill_image_url}
                    alt={`Bill or receipt for ${receipt.item?.name || 'stock receipt'}`}
                    className="inventory-receipt-image"
                  />
                )}
              </div>
            ) : (
              <p className="panel-copy">No bill image was attached to this receipt.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
