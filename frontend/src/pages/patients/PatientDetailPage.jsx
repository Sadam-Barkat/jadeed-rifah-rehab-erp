import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import '../pages.css'

function Cell({ label, value, span }) {
  if (value == null || String(value).trim() === '') return null
  return (
    <div className={`gov-cell${span ? ` gov-span-${span}` : ''}`}>
      <span className="gov-label">{label}</span>
      <span className="gov-value">{value}</span>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const isAdmin = user?.role_slug === 'admin'
  const isReception = user?.role_slug === 'receptionist'

  const backTo =
    location.state?.backTo ||
    (isReception
      ? '/app/reception?tab=pending'
      : isAdmin
        ? '/app/management?tab=patients&status=registered'
        : '/app/patients')

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

  async function approve() {
    setSaving(true)
    try {
      const data = await api(`/patients/${id}/approve`, { method: 'POST' })
      toast.success(data.message || 'Request approved')
      setPatient(data.data)
      navigate('/app/management?tab=patients&status=approved', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Approve failed')
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    setSaving(true)
    try {
      const data = await api(`/patients/${id}/reject`, {
        method: 'POST',
        body: { reason: rejectReason.trim() || null },
      })
      toast.success(data.message || 'Request rejected')
      setRejectOpen(false)
      setRejectReason('')
      setPatient(data.data)
      navigate('/app/management?tab=patients&status=rejected', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Reject failed')
    } finally {
      setSaving(false)
    }
  }

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
        <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>
          Back
        </Link>
      </div>
    )
  }

  const guardian = patient.guardians?.[0]
  const statusLabel = String(patient.status || '').replaceAll('_', ' ')
  const canDecide = isAdmin && patient.status === 'registered'
  const canAssignBed = isReception && patient.status === 'approved'

  return (
    <div className="page patient-profile">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">{patient.patient_code}</p>
          <h2>{patient.full_name}</h2>
        </div>
        <div className="page-actions">
          {canDecide ? (
            <>
              <Button type="button" disabled={saving} onClick={approve}>
                {saving ? 'Saving…' : 'Approve'}
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </>
          ) : null}
          {canAssignBed ? (
            <Link
              className="ui-btn ui-btn-primary ui-btn-md"
              to={`/app/reception?tab=assign&patient_id=${patient.id}`}
            >
              Assign bed
            </Link>
          ) : null}
          {isAdmin && patient.status === 'discharge_requested' ? (
            <Link
              className="ui-btn ui-btn-primary ui-btn-md"
              to="/app/discharge"
              state={{ patientId: patient.id, backTo }}
            >
              Confirm discharge
            </Link>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            Print / PDF
          </Button>
          <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>
            Back
          </Link>
        </div>
      </div>

      <div className="gov-form" id="patient-print">
        <header className="gov-form-head">
          <div className="gov-brand-row">
            <img className="gov-brand-logo" src="/brand/jadeed-logo.png?v=6" alt="" />
            <p className="gov-org">Jadeed Rifah Rehab &amp; Care Center</p>
          </div>
          <h2 className="gov-title">Patient Registration Form</h2>
          <p className="gov-meta">
            {patient.patient_code}
            {' · '}
            {statusLabel}
            {patient.plan_days ? ` · ${patient.plan_days}-day plan` : ''}
          </p>
        </header>

        <section className="gov-cnic-block">
          <div className="gov-cnic-card">
            {patient.cnic_front_url ? (
              <img src={patient.cnic_front_url} alt="CNIC front" />
            ) : (
              <div className="gov-cnic-empty">No front image</div>
            )}
            <span>CNIC Front</span>
          </div>
          <div className="gov-cnic-card">
            {patient.cnic_back_url ? (
              <img src={patient.cnic_back_url} alt="CNIC back" />
            ) : (
              <div className="gov-cnic-empty">No back image</div>
            )}
            <span>CNIC Back</span>
          </div>
        </section>

        {guardian ? (
          <section className="gov-cnic-block">
            <div className="gov-cnic-card">
              {guardian.cnic_front_url ? (
                <img src={guardian.cnic_front_url} alt="Guardian CNIC front" />
              ) : (
                <div className="gov-cnic-empty">No front image</div>
              )}
              <span>Guardian CNIC Front</span>
            </div>
            <div className="gov-cnic-card">
              {guardian.cnic_back_url ? (
                <img src={guardian.cnic_back_url} alt="Guardian CNIC back" />
              ) : (
                <div className="gov-cnic-empty">No back image</div>
              )}
              <span>Guardian CNIC Back</span>
            </div>
          </section>
        ) : null}

        <section className="gov-grid">
          <Cell label="Patient code" value={patient.patient_code} />
          <Cell label="Status" value={statusLabel} />
          <Cell label="Full name" value={patient.full_name} span={2} />
          <Cell label="First name" value={patient.first_name} />
          <Cell label="Last name" value={patient.last_name} />
          <Cell label="Father name" value={patient.father_name} />
          <Cell label="CNIC number" value={patient.cnic} />
          <Cell label="Gender" value={patient.gender} />
          <Cell label="Date of birth" value={patient.date_of_birth} />
          <Cell label="Age" value={patient.age} />
          <Cell label="Blood group" value={patient.blood_group} />
          <Cell label="Marital status" value={patient.marital_status} />
          <Cell label="Phone" value={patient.phone} />
          <Cell label="City" value={patient.city} />
          <Cell label="Plan" value={patient.plan_days ? `${patient.plan_days} days` : null} />
          <Cell label="Referral source" value={patient.referral_source} />
          <Cell label="Registered" value={patient.created_at} />
          <Cell label="Address" value={patient.address} span={2} />
          <Cell label="Guardian name" value={guardian?.name} />
          <Cell label="Guardian relation" value={guardian?.relation} />
          <Cell label="Guardian phone" value={guardian?.phone} />
          <Cell label="Guardian CNIC" value={guardian?.cnic} />
          <Cell label="Guardian address" value={guardian?.address} span={2} />
        </section>
      </div>

      <Modal
        open={rejectOpen}
        title="Reject request"
        size="sm"
        onClose={() => {
          if (saving) return
          setRejectOpen(false)
          setRejectReason('')
        }}
        confirmLabel={saving ? 'Saving…' : 'Reject'}
        onConfirm={reject}
        confirm
        danger
      >
        <div className="ui-field">
          <label htmlFor="reject_reason">Reason (optional)</label>
          <input
            id="reject_reason"
            className="ui-input"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={255}
          />
        </div>
      </Modal>
    </div>
  )
}
