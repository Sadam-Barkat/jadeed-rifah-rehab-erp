import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import '../pages.css'

function formatExperience(joinedAt) {
  if (!joinedAt) return '—'
  const start = new Date(joinedAt)
  if (Number.isNaN(start.getTime())) return '—'
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0 && rem === 0) return 'Less than 1 month'
  if (years === 0) return `${rem} month${rem === 1 ? '' : 's'}`
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`
  return `${years} year${years === 1 ? '' : 's'} ${rem} month${rem === 1 ? '' : 's'}`
}

function printMissingFields(staff) {
  const checks = [
    ['Full name', staff?.name],
    ['Father name', staff?.father_name],
    ['CNIC', staff?.cnic],
    ['Phone', staff?.phone],
    ['Email', staff?.email],
    ['Gender', staff?.gender],
    ['Date of birth', staff?.date_of_birth],
    ['Qualification', staff?.qualification],
    ['Role', staff?.role?.name],
    ['Joined on', staff?.joined_at || staff?.joined_at_label],
    ['Address', staff?.address],
    ['City', staff?.city],
  ]
  return checks.filter(([, value]) => !String(value || '').trim()).map(([label]) => label)
}

export default function StaffDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState(null)
  const [printBlockOpen, setPrintBlockOpen] = useState(false)
  const [missing, setMissing] = useState([])

  const backTo = location.state?.backTo || '/app/management?tab=staff'

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await api(`/users/${id}`)
        if (!cancelled) setStaff(data.data)
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Failed to load staff')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const experience = useMemo(() => formatExperience(staff?.joined_at), [staff?.joined_at])

  function requestPrint() {
    const gaps = printMissingFields(staff)
    if (gaps.length) {
      setMissing(gaps)
      setPrintBlockOpen(true)
      return
    }
    window.print()
  }

  if (loading) {
    return (
      <div className="page">
        <Skeleton height={28} width="220px" />
        <Skeleton height={180} className="mt-3" />
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="page">
        <p className="panel-copy">Staff not found.</p>
        <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>
          Back
        </Link>
      </div>
    )
  }

  const relation = String(staff.gender || '').toLowerCase() === 'female' ? 'D/O' : 'S/O'

  return (
    <div className="page patient-profile">
      <div className="page-header no-print">
        <div>
          <p className="eyebrow">{staff.staff_code || 'Staff'}</p>
          <h2>{staff.name}</h2>
        </div>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={requestPrint}>
            Print certificate
          </Button>
          <Link className="ui-btn ui-btn-back ui-btn-md" to={backTo}>
            Back
          </Link>
        </div>
      </div>

      <div className="staff-cert" id="staff-print">
        <div className="staff-cert-inner">
          <header className="staff-cert-head">
            <img className="staff-cert-logo" src="/brand/jadeed-logo.png?v=6" alt="" />
            <p className="staff-cert-org">Jadeed Rifah Rehab &amp; Care Center</p>
          </header>

          <h1 className="staff-cert-title">Certificate of Service</h1>

          <div className="staff-cert-body">
            <div className="staff-cert-photo">
              {staff.photo_url ? (
                <img src={staff.photo_url} alt={staff.name} />
              ) : (
                <div className="staff-cert-photo-empty" aria-hidden="true" />
              )}
            </div>

            <div className="staff-cert-copy">
              <p>
                This is to certify that <strong>{staff.name || '—'}</strong>, {relation}{' '}
                <strong>{staff.father_name || '—'}</strong>, holding CNIC{' '}
                <strong>{staff.cnic || '—'}</strong>, has been serving at Jadeed Rifah Rehab &amp; Care
                Center as <strong>{staff.role?.name || '—'}</strong>.
              </p>
              <p>
                Period of service: <strong>{staff.joined_at_label || staff.joined_at || '—'}</strong> to
                date
                {experience && experience !== '—' ? (
                  <>
                    {' '}
                    (experience: <strong>{experience}</strong>)
                  </>
                ) : null}
                .
              </p>
              <p>
                Contact: <strong>{staff.phone || '—'}</strong>
                {staff.email ? (
                  <>
                    {' '}
                    · <strong>{staff.email}</strong>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <dl className="staff-cert-grid">
            <div>
              <dt>Staff code</dt>
              <dd>{staff.staff_code || '—'}</dd>
            </div>
            <div>
              <dt>Qualification</dt>
              <dd>{staff.qualification || '—'}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{staff.date_of_birth || '—'}</dd>
            </div>
            <div>
              <dt>Gender</dt>
              <dd>{staff.gender || '—'}</dd>
            </div>
            <div className="staff-cert-span">
              <dt>Address</dt>
              <dd>
                {[staff.address, staff.city].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
          </dl>

          <footer className="staff-cert-foot">
            <div>
              <span>Authorized signature</span>
              <em />
            </div>
            <div>
              <span>Facility stamp</span>
              <em />
            </div>
          </footer>
        </div>
      </div>

      <Modal
        open={printBlockOpen}
        title="Missing details"
        confirm
        size="sm"
        cancelLabel="Close"
        confirmLabel="OK"
        onClose={() => setPrintBlockOpen(false)}
        onConfirm={() => setPrintBlockOpen(false)}
      >
        <p className="staff-missing-intro">Add in Edit staff:</p>
        <ul className="staff-missing-list">
          {missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
