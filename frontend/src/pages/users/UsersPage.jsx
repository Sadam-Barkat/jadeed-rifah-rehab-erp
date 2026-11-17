import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyForm = {
  name: '',
  father_name: '',
  email: '',
  phone: '',
  cnic: '',
  gender: '',
  date_of_birth: '',
  address: '',
  city: '',
  qualification: '',
  joined_on: '',
  role_id: '',
  is_active: true,
}

const ROLE_FILTERS = [
  { id: '', label: 'All staff' },
  { id: 'doctor', label: 'Doctors' },
  { id: 'nurse', label: 'Nurses' },
  { id: 'receptionist', label: 'Reception' },
  { id: 'pharmacist', label: 'Pharmacy' },
  { id: 'finance', label: 'Finance' },
  { id: 'inventory-manager', label: 'Inventory' },
  { id: 'gatekeeper', label: 'Gate' },
]

const PER_PAGE = 12

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

/** Pakistan-friendly WhatsApp number → international digits without +. */
function whatsappNumber(phone) {
  let digits = digitsOnly(phone)
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length === 11) digits = `92${digits.slice(1)}`
  if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`
  return digits
}

function credentialsMessage(creds) {
  return [
    'Login credentials — Jadeed Rifah Rehab ERP',
    '',
    `Email: ${creds.email || '—'}`,
    `Password: ${creds.temporary_password || '—'}`,
    `Attendance code: ${creds.attendance_code || '—'}`,
    '',
    'Show attendance code at the gate for daily check-in.',
  ].join('\n')
}

export default function UsersPage({ embedded = false }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [credentials, setCredentials] = useState(null)

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function buildStaffFormData(extra = {}) {
    const fd = new FormData()
    const textFields = [
      'name',
      'father_name',
      'email',
      'phone',
      'cnic',
      'gender',
      'date_of_birth',
      'address',
      'city',
      'qualification',
      'joined_on',
      'role_id',
    ]
    textFields.forEach((key) => {
      const value = form[key]
      if (value !== '' && value !== null && value !== undefined) {
        fd.append(key, String(value).trim ? String(value).trim() : String(value))
      }
    })
    Object.entries(extra).forEach(([key, value]) => {
      fd.append(key, value)
    })
    if (photoFile) fd.append('photo', photoFile)
    return fd
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debounced, roleFilter])

  async function load(nextPage = page) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        per_page: String(PER_PAGE),
      })
      if (debounced) params.set('search', debounced)
      if (roleFilter) params.set('role', roleFilter)

      const [roleRes, userRes] = await Promise.all([
        api('/roles'),
        api(`/users?${params.toString()}`),
      ])
      setRoles(roleRes.data || [])
      setUsers(userRes.data || [])
      setMeta(userRes.meta || { current_page: 1, last_page: 1, total: 0 })
    } catch (err) {
      toast.error(err.message || 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page)
  }, [page, debounced, roleFilter])

  const roleName = useMemo(() => {
    const map = {}
    roles.forEach((r) => {
      map[r.id] = r.name
    })
    return map
  }, [roles])

  function openAdd() {
    setForm(emptyForm)
    setPhotoFile(null)
    setAddOpen(true)
  }

  function openEdit(user) {
    setEditUser(user)
    setPhotoFile(null)
    setForm({
      name: user.name || '',
      father_name: user.father_name || '',
      email: user.email || '',
      phone: user.phone || '',
      cnic: user.cnic || '',
      gender: user.gender || '',
      date_of_birth: user.date_of_birth || '',
      address: user.address || '',
      city: user.city || '',
      qualification: user.qualification || '',
      joined_on: user.joined_at || '',
      role_id: user.role?.id ? String(user.role.id) : '',
      is_active: Boolean(user.is_active),
    })
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.role_id) {
      toast.error('Name, email, phone, and role are required')
      return
    }
    setSaving(true)
    try {
      const body = buildStaffFormData({ generate_password: '1' })
      const data = await api('/users', { method: 'POST', body })
      toast.success(`${data.data.name} created`)
      setAddOpen(false)
      setForm(emptyForm)
      setPhotoFile(null)
      setCredentials(data.credentials || null)
      setPage(1)
      await load(1)
    } catch (err) {
      toast.error(err.message || 'Failed to create staff')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!editUser) return
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.role_id) {
      toast.error('Name, email, phone, and role are required')
      return
    }
    setSaving(true)
    try {
      const body = buildStaffFormData({
        is_active: form.is_active ? '1' : '0',
      })
      await api(`/users/${editUser.id}`, { method: 'POST', body })
      toast.success('Staff updated')
      setEditUser(null)
      setPhotoFile(null)
      await load(page)
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function regeneratePassword(user) {
    try {
      const data = await api(`/users/${user.id}`, {
        method: 'PUT',
        body: { reset_password: true },
      })
      setCredentials({
        ...(data.credentials || {}),
        phone: data.credentials?.phone || user.phone || '',
        name: data.credentials?.name || user.name || '',
      })
      toast.success('New password generated')
    } catch (err) {
      toast.error(err.message || 'Regenerate failed')
    }
  }

  async function copyCreds() {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(credentialsMessage(credentials))
      toast.success('Copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  function openWhatsApp() {
    if (!credentials) return
    const number = whatsappNumber(credentials.phone)
    if (!number) {
      toast.error('Add staff phone number first')
      return
    }
    const url = `https://wa.me/${number}?text=${encodeURIComponent(credentialsMessage(credentials))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const staffFormFields = (
    <div className="form-grid">
      <div className="ui-field">
        <label htmlFor="staff_name">Full name</label>
        <input
          id="staff_name"
          className="ui-input"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_father">Father name</label>
        <input
          id="staff_father"
          className="ui-input"
          value={form.father_name}
          onChange={(e) => setField('father_name', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_email">Email</label>
        <input
          id="staff_email"
          type="email"
          className="ui-input"
          required
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_phone">Phone</label>
        <input
          id="staff_phone"
          className="ui-input"
          required
          inputMode="tel"
          placeholder="03XXXXXXXXX"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_cnic">CNIC</label>
        <input
          id="staff_cnic"
          className="ui-input"
          placeholder="xxxxx-xxxxxxx-x"
          value={form.cnic}
          onChange={(e) => setField('cnic', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_gender">Gender</label>
        <select
          id="staff_gender"
          className="ui-select"
          value={form.gender}
          onChange={(e) => setField('gender', e.target.value)}
        >
          <option value="">Select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="ui-field">
        <label htmlFor="staff_dob">Date of birth</label>
        <input
          id="staff_dob"
          type="date"
          className="ui-input"
          value={form.date_of_birth}
          onChange={(e) => setField('date_of_birth', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_joined">Joined on</label>
        <input
          id="staff_joined"
          type="date"
          className="ui-input"
          value={form.joined_on}
          onChange={(e) => setField('joined_on', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_role">Role</label>
        <select
          id="staff_role"
          className="ui-select"
          required
          value={form.role_id}
          onChange={(e) => setField('role_id', e.target.value)}
        >
          <option value="">Select</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div className="ui-field">
        <label htmlFor="staff_qualification">Qualification</label>
        <input
          id="staff_qualification"
          className="ui-input"
          value={form.qualification}
          onChange={(e) => setField('qualification', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_city">City</label>
        <input
          id="staff_city"
          className="ui-input"
          value={form.city}
          onChange={(e) => setField('city', e.target.value)}
        />
      </div>
      <div className="ui-field full">
        <label htmlFor="staff_address">Address</label>
        <input
          id="staff_address"
          className="ui-input"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="staff_photo">Photo</label>
        <input
          id="staff_photo"
          className="ui-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            if (file && file.size > 40 * 1024 * 1024) {
              toast.error('Photo must be 40 MB or smaller.')
              e.target.value = ''
              setPhotoFile(null)
              return
            }
            setPhotoFile(file)
          }}
        />
      </div>
      {editUser ? (
        <div className="ui-field">
          <label htmlFor="staff_status">Status</label>
          <select
            id="staff_status"
            className="ui-select"
            value={form.is_active ? '1' : '0'}
            onChange={(e) => setField('is_active', e.target.value === '1')}
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className={embedded ? 'embedded-page' : 'page'}>
      {embedded ? null : (
        <div className="page-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Staff & Users</h2>
          </div>
          <div className="page-actions">
            <Button type="button" onClick={openAdd}>Add staff</Button>
          </div>
        </div>
      )}

      <div className="mgmt-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Staff roles">
          {ROLE_FILTERS.map((tab) => (
            <button
              key={tab.id || 'all'}
              type="button"
              role="tab"
              aria-selected={roleFilter === tab.id}
              className={`filter-tab ${roleFilter === tab.id ? 'is-active' : ''}`}
              onClick={() => setRoleFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mgmt-toolbar-actions">
          <input
            className="ui-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff"
            aria-label="Search staff"
          />
          {embedded ? (
            <Button type="button" onClick={openAdd}>Add staff</Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={4} />
      ) : users.length === 0 ? (
        <p className="panel-copy">No staff found.</p>
      ) : (
        <div className="entity-card-grid">
          {users.map((u) => (
            <article key={u.id} className={`entity-card ${u.is_active ? '' : 'is-inactive'}`}>
              <div className="entity-card-top">
                <div>
                  <p className="entity-card-code">
                    {u.staff_code || '—'}
                    {u.attendance_code ? ` · PIN ${u.attendance_code}` : ''}
                  </p>
                  <h3>{u.name}</h3>
                </div>
                <span className={`badge ${u.is_active ? 'badge-success' : 'badge-muted'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <dl className="entity-card-meta">
                <div>
                  <dt>Role</dt>
                  <dd>{u.role?.name || roleName[u.role?.id] || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{u.email || '—'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{u.phone || '—'}</dd>
                </div>
              </dl>
              <div className="entity-card-actions">
                <Link
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                  to={`/app/users/${u.id}`}
                  state={embedded ? { backTo: '/app/management?tab=staff' } : { backTo: '/app/users' }}
                >
                  View
                </Link>
                <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(u)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => regeneratePassword(u)}>
                  Regenerate
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination
        page={meta.current_page}
        lastPage={meta.last_page}
        total={meta.total}
        perPage={PER_PAGE}
        itemLabel="staff"
        disabled={loading}
        onChange={setPage}
      />

      <Modal
        open={addOpen}
        title="Add staff"
        size="lg"
        confirmLabel={saving ? 'Creating…' : 'Create'}
        onClose={() => !saving && setAddOpen(false)}
        onConfirm={handleCreate}
      >
        {staffFormFields}
      </Modal>

      <Modal
        open={Boolean(editUser)}
        title="Edit staff"
        size="lg"
        confirmLabel={saving ? 'Saving…' : 'Save'}
        onClose={() => !saving && setEditUser(null)}
        onConfirm={handleUpdate}
      >
        {staffFormFields}
      </Modal>

      <Modal
        open={Boolean(credentials)}
        title="Login credentials"
        hideFooter
        onClose={() => setCredentials(null)}
      >
        {credentials ? (
          <div className="cred-block">
            <div className="cred-secret">
              <div>
                <span>Email</span>
                <strong>{credentials.email || '—'}</strong>
              </div>
              <div>
                <span>Password</span>
                <strong className="cred-password">{credentials.temporary_password}</strong>
              </div>
              <div>
                <span>Attendance code</span>
                <strong className="cred-password">{credentials.attendance_code || '—'}</strong>
              </div>
            </div>
            <div className="cred-actions">
              <Button type="button" variant="secondary" onClick={copyCreds}>
                <Copy size={16} />
                Copy
              </Button>
              <Button type="button" onClick={openWhatsApp}>
                <MessageCircle size={16} />
                WhatsApp
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCredentials(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
