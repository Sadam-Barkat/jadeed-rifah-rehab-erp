import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

export default function BedsPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [rooms, setRooms] = useState([])

  async function load() {
    setLoading(true)
    try {
      const data = await api('/beds')
      setSummary(data.summary)
      setRooms(data.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load beds')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function setStatus(bedId, status) {
    try {
      await api(`/beds/${bedId}/status`, {
        method: 'PATCH',
        body: { status },
      })
      toast.success('Bed status updated')
      load()
    } catch (err) {
      toast.error(err.message || 'Update failed')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Patient Care</p>
          <h2>Bed & Room Management</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <>
          <div className="stat-grid">
            <article className="stat-card">
              <p>Total beds</p>
              <strong>{summary?.total_beds ?? 0}</strong>
            </article>
            <article className="stat-card">
              <p>Available</p>
              <strong>{summary?.available ?? 0}</strong>
            </article>
            <article className="stat-card">
              <p>Occupied</p>
              <strong>{summary?.occupied ?? 0}</strong>
            </article>
            <article className="stat-card">
              <p>Maintenance / Cleaning</p>
              <strong>{(summary?.maintenance ?? 0) + (summary?.cleaning ?? 0)}</strong>
            </article>
          </div>

          {rooms.map((room) => (
            <section className="panel" key={room.id}>
              <div className="panel-head">
                <h3>
                  {room.name} ({room.code}) · Floor {room.floor || '—'}
                </h3>
                <span className="badge">{room.room_type || room.status}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bed</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.beds.map((bed) => (
                      <tr key={bed.id}>
                        <td>{bed.bed_code}</td>
                        <td>
                          <span className="badge">{bed.status}</span>
                        </td>
                        <td>
                          <div className="page-actions">
                            {bed.status !== 'available' && bed.status !== 'occupied' ? (
                              <Button size="sm" variant="ghost" onClick={() => setStatus(bed.id, 'available')}>
                                Mark available
                              </Button>
                            ) : null}
                            {bed.status === 'available' ? (
                              <Button size="sm" variant="ghost" onClick={() => setStatus(bed.id, 'maintenance')}>
                                Maintenance
                              </Button>
                            ) : null}
                            {bed.status === 'occupied' ? (
                              <Button size="sm" variant="ghost" onClick={() => setStatus(bed.id, 'cleaning')}>
                                Cleaning
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
