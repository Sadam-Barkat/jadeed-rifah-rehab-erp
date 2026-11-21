import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { SkeletonCards } from '../../components/ui/Skeleton'
import RegistrationPage from '../patients/RegistrationPage'
import '../pages.css'

const TABS = [
  { id: 'register', label: 'Register' },
  { id: 'pending', label: 'Pending' },
  { id: 'assign', label: 'Assign bed' },
  { id: 'admitted', label: 'Admitted' },
]
const VALID = new Set(TABS.map((t) => t.id))
const PAGE_SIZE = 12

function normalizeTab(raw) {
  if (raw === 'requests') return 'pending'
  return VALID.has(raw) ? raw : 'register'
}

function paginate(list, page, size = PAGE_SIZE) {
  const total = list.length
  const lastPage = Math.max(1, Math.ceil(total / size) || 1)
  const current = Math.min(Math.max(1, page), lastPage)
  const start = (current - 1) * size
  return { rows: list.slice(start, start + size), page: current, lastPage, total }
}

export default function ReceptionDeskPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = normalizeTab(searchParams.get('tab') || 'register')
  const focusPatientId = searchParams.get('patient_id') || ''

  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [beds, setBeds] = useState([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [bedId, setBedId] = useState('')
  const [saving, setSaving] = useState(false)

  function setTab(id) {
    const next = new URLSearchParams()
    if (id !== 'register') next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
    setSearch('')
    setDebounced('')
  }, [tab])

  async function loadList() {
    if (tab === 'register') return
    setLoading(true)
    try {
      const status =
        tab === 'pending' ? 'registered' : tab === 'assign' ? 'approved' : 'admitted'
      const q = new URLSearchParams({ status, per_page: '50' })
      if (debounced) q.set('search', debounced)
      const res = await api(`/patients?${q}`)
      setRows(res.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load patients')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [tab, debounced])

  useEffect(() => {
    if (tab !== 'assign') return undefined
    let alive = true
    api('/beds/available')
      .then((res) => {
        if (alive) setBeds(res.data || [])
      })
      .catch(() => {
        if (alive) setBeds([])
      })
    return () => {
      alive = false
    }
  }, [tab])

  useEffect(() => {
    if (tab !== 'assign' || !focusPatientId || rows.length === 0) return
    const row = rows.find((p) => String(p.id) === String(focusPatientId))
    if (row) openAssign(row)
  }, [tab, focusPatientId, rows])

  const pageData = useMemo(() => paginate(rows, page), [rows, page])

  function openAssign(patient) {
    setActive(patient)
    setBedId('')
    setAssignOpen(true)
  }

  async function assignBed() {
    if (!active) return
    if (!bedId) {
      toast.error('Select a bed')
      return
    }
    setSaving(true)
    try {
      const res = await api('/admissions', {
        method: 'POST',
        body: {
          patient_id: Number(active.id),
          bed_id: Number(bedId),
          program_days: Number(active.plan_days || 30),
          package_name: `${active.plan_days || 30}-Day Program`,
          activate: true,
        },
      })
      toast.success(res.message || 'Patient admitted')
      setAssignOpen(false)
      setActive(null)
      setBedId('')
      setTab('admitted')
      navigate('/app/reception?tab=admitted', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Bed assign failed')
    } finally {
      setSaving(false)
    }
  }

  const tabLabel =
    tab === 'pending' ? 'Pending' : tab === 'assign' ? 'Assign bed' : tab === 'admitted' ? 'Admitted' : 'Register'

  function statusBadge(status) {
    if (status === 'registered') return 'pending'
    return String(status || '').replaceAll('_', ' ')
  }

  return (
    <div className="page finance-page">
      {tab === 'register' ? null : (
        <div className="page-header no-print">
          <div>
            <p className="eyebrow">Reception</p>
            <h2>{tabLabel}</h2>
          </div>
        </div>
      )}

      {tab === 'register' ? (
        <RegistrationPage embedded backTo="/app/reception?tab=pending" />
      ) : (
        <>
          <div className="list-toolbar no-print">
            <input
              type="search"
              className="ui-input"
              placeholder="Search code, name, phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <SkeletonCards count={4} />
          ) : pageData.total === 0 ? (
            <section className="panel">
              <p className="panel-copy">
                {tab === 'pending'
                  ? 'No pending requests.'
                  : tab === 'assign'
                    ? 'No approved patients waiting for a bed.'
                    : 'No admitted patients yet.'}
              </p>
            </section>
          ) : (
            <>
              <div className="scroll-panel entity-card-grid">
                {pageData.rows.map((p) => (
                  <article key={p.id} className="entity-card">
                    <div className="entity-card-top">
                      <div>
                        <p className="entity-card-code">{p.patient_code}</p>
                        <h3>{p.full_name}</h3>
                      </div>
                      <span className="badge">{statusBadge(p.status)}</span>
                    </div>
                    <dl className="entity-card-meta">
                      <div>
                        <dt>Phone</dt>
                        <dd>{p.phone || '—'}</dd>
                      </div>
                      <div>
                        <dt>Plan</dt>
                        <dd>{p.plan_days ? `${p.plan_days} days` : '—'}</dd>
                      </div>
                    </dl>
                    <div className="entity-card-actions">
                      <Link
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                        to={`/app/patients/${p.id}`}
                        state={{ backTo: `/app/reception?tab=${tab}` }}
                      >
                        View
                      </Link>
                      {tab === 'assign' ? (
                        <Button type="button" size="sm" onClick={() => openAssign(p)}>
                          Assign bed
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <Pagination
                page={pageData.page}
                lastPage={pageData.lastPage}
                disabled={loading}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      <Modal
        open={assignOpen}
        title="Assign bed"
        onClose={() => {
          setAssignOpen(false)
          setActive(null)
          setBedId('')
        }}
        confirmLabel={saving ? 'Saving…' : 'Admit'}
        onConfirm={assignBed}
        confirm
      >
        {active ? (
          <>
            <dl className="entity-card-meta" style={{ marginBottom: 12 }}>
              <div>
                <dt>Patient</dt>
                <dd>
                  {active.patient_code} · {active.full_name}
                </dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{active.plan_days ? `${active.plan_days} days` : '—'}</dd>
              </div>
            </dl>
            <div className="ui-field">
              <label htmlFor="reception_bed">Available bed</label>
              <select
                id="reception_bed"
                className="ui-select"
                value={bedId}
                onChange={(e) => setBedId(e.target.value)}
                disabled={!beds.length}
              >
                <option value="">{beds.length ? 'Select bed' : 'No beds available'}</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bed_code} · {b.room_name} (Floor {b.floor || '—'})
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
