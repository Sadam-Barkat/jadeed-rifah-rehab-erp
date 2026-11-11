import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Skeleton from '../../components/ui/Skeleton'
import '../pages.css'

export default function PatientDetailPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await api(`/patients/${id}`)
        if (!cancelled) setPatient(data.data)
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load patient')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="page">
        <Skeleton height={28} width="220px" />
        <Skeleton height={180} className="mt-3" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="page">
        <p className="panel-copy">Patient not found.</p>
        <Link className="ui-btn ui-btn-ghost ui-btn-md" to="/app/patients">
          Back to patients
        </Link>
      </div>
    )
  }

  const guardian = patient.guardians?.[0]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{patient.patient_code}</p>
          <h2>{patient.full_name}</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-ghost ui-btn-md" to="/app/patients">
            Back
          </Link>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Patient details</h3>
            <span className="badge">{patient.status}</span>
          </div>
          <div className="detail-grid">
            <div>
              <span>Phone</span>
              <strong>{patient.phone || '—'}</strong>
            </div>
            <div>
              <span>CNIC</span>
              <strong>{patient.cnic || '—'}</strong>
            </div>
            <div>
              <span>Gender</span>
              <strong>{patient.gender || '—'}</strong>
            </div>
            <div>
              <span>Age</span>
              <strong>{patient.age ?? '—'}</strong>
            </div>
            <div>
              <span>City</span>
              <strong>{patient.city || '—'}</strong>
            </div>
            <div>
              <span>Referral</span>
              <strong>{patient.referral_source || '—'}</strong>
            </div>
            <div className="full">
              <span>Address</span>
              <strong>{patient.address || '—'}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Guardian</h3>
          </div>
          {guardian ? (
            <div className="detail-grid">
              <div>
                <span>Name</span>
                <strong>{guardian.name}</strong>
              </div>
              <div>
                <span>Relation</span>
                <strong>{guardian.relation || '—'}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{guardian.phone || '—'}</strong>
              </div>
              <div>
                <span>CNIC</span>
                <strong>{guardian.cnic || '—'}</strong>
              </div>
            </div>
          ) : (
            <p className="panel-copy">No guardian recorded.</p>
          )}
        </section>
      </div>
    </div>
  )
}
