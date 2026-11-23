import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

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

export default function MedicineSlipPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const autoprint = searchParams.get('autoprint') === '1'
  const [loading, setLoading] = useState(true)
  const [rx, setRx] = useState(null)
  const printedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await api(`/medicine-prescriptions/${id}`)
        if (!cancelled) setRx(res.data)
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load medicine slip')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!autoprint || loading || !rx || printedRef.current) return undefined
    printedRef.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('autoprint')
    setSearchParams(next, { replace: true })
    const t = setTimeout(() => window.print(), 80)
    return () => clearTimeout(t)
  }, [autoprint, loading, rx, searchParams, setSearchParams])

  return (
    <div className="page print-page medicine-slip-page">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">Medicine slip</p>
          <h2>{rx?.prescription_code || 'Medicine slip'}</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={() => window.print()} disabled={loading || !rx}>
            Print
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/app/pharmacy?tab=prescriptions')}>
            Back
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={2} />
      ) : !rx ? (
        <p className="panel-copy">Medicine slip not found.</p>
      ) : (
        <section className="panel print-stock-panel">
          <header className="print-dash-head">
            <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
            <h2>Medicine slip</h2>
            <p>{rx.prescription_code}</p>
          </header>

          <div className="print-table-wrap">
            <dl className="rx-meta-list">
              <div className="rx-meta-row">
                <dt>Patient</dt>
                <dd>
                  {rx.patient?.full_name || '—'}
                  {rx.patient?.patient_code ? ` · ${rx.patient.patient_code}` : ''}
                </dd>
              </div>
              <div className="rx-meta-row">
                <dt>Admission</dt>
                <dd>{rx.admission?.admission_code || '—'}</dd>
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
              <div className="rx-meta-row">
                <dt>Dispenser</dt>
                <dd>{rx.dispenser?.name || rx.dispensed_by || '—'}</dd>
              </div>
              <div className="rx-meta-row">
                <dt>Dispensed</dt>
                <dd>{formatWhen(rx.dispensed_at)}</dd>
              </div>
            </dl>

            <table className="data-table" style={{ marginTop: 12, minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Qty</th>
                  <th>Dosage</th>
                  <th>When to give</th>
                  <th>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {(rx.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.medicine_name}
                      {item.medicine?.strength ? (
                        <>
                          <br />
                          <small>{item.medicine.strength}</small>
                        </>
                      ) : null}
                    </td>
                    <td>{item.dispensed_qty || item.quantity}</td>
                    <td>{item.dosage || '—'}</td>
                    <td>{item.frequency || '—'}</td>
                    <td>{item.instructions || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
