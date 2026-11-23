import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatPkrExact } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import { homePathForUser } from '../../lib/roleHomes'
import '../pages.css'

export default function MedicineReceiptPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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
        const response = await api(`/notifications/medicine-receipts/${id}`)
        if (active) setReceipt(response.data)
      } catch (err) {
        if (active) {
          setReceipt(null)
          setError(err.message || 'Could not load this medicine receipt.')
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
          <p className="eyebrow">Pharmacy notification</p>
          <h2>Medicine stock received</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="back" onClick={() => navigate(homePathForUser(user))}>
            Back
          </Button>
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
              <h3>Receipt details</h3>
              <span className="badge">Stock in</span>
            </div>
            <div className="detail-grid">
              <div>
                <span>Items</span>
                <strong>{receipt.item_count || 0}</strong>
              </div>
              <div>
                <span>Total purchase cost</span>
                <strong>{formatPkrExact(receipt.total_cost)}</strong>
              </div>
              <div>
                <span>Supplier</span>
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
              <h3>Medicines</h3>
            </div>
            <div className="scroll-panel dash-scroll-panel">
              <table className="data-table" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Form</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(receipt.items || []).map((item) => (
                    <tr key={item.movement_code}>
                      <td>{item.medicine_code || '—'}</td>
                      <td>
                        {item.name || '—'}
                        {item.strength ? <><br /><small>{item.strength}</small></> : null}
                      </td>
                      <td>{item.form || '—'}</td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>{formatPkrExact(item.unit_cost)}</td>
                      <td>{formatPkrExact(item.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    title="Uploaded medicine bill"
                    className="inventory-receipt-pdf"
                  />
                ) : (
                  <img
                    src={receipt.bill_image_url}
                    alt="Medicine stock bill"
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
