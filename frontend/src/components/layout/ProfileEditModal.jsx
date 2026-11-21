import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { isWithinUploadLimit, uploadTooLargeMessage } from '../../lib/uploadLimits'
import { useAuth } from '../../context/AuthContext'
import Modal from '../ui/Modal'

const emptyForm = {
  name: '',
  father_name: '',
  date_of_birth: '',
  address: '',
  city: '',
}

function LockedField({ label, value }) {
  return (
    <div className="ui-field">
      <label>{label}</label>
      <div className="ui-input is-locked" aria-readonly="true">
        {value || '—'}
      </div>
    </div>
  )
}

export default function ProfileEditModal({ open, onClose }) {
  const { user, refreshUser } = useAuth()
  const fileRef = useRef(null)
  const [form, setForm] = useState(emptyForm)
  const [locked, setLocked] = useState({})
  const [photoFile, setPhotoFile] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const previewUrl = useMemo(() => {
    if (removePhoto) return ''
    if (photoFile) return URL.createObjectURL(photoFile)
    return locked.photo_url || ''
  }, [photoFile, removePhoto, locked.photo_url])

  useEffect(() => {
    if (!photoFile) return undefined
    return () => URL.revokeObjectURL(previewUrl)
  }, [photoFile, previewUrl])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false

    async function loadFromDb() {
      setLoadingProfile(true)
      setPhotoFile(null)
      setRemovePhoto(false)
      try {
        const data = await api('/me')
        if (cancelled) return
        const u = data.user || {}
        await refreshUser?.(u)
        setForm({
          name: u.name || '',
          father_name: u.father_name || '',
          date_of_birth: u.date_of_birth || '',
          address: u.address || '',
          city: u.city || '',
        })
        setLocked({
          role: u.role || '',
          email: u.email || '',
          cnic: u.cnic || '',
          staff_code: u.staff_code || '',
          phone: u.phone || '',
          gender: u.gender || '',
          photo_url: u.photo_url || '',
        })
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || 'Failed to load profile')
          setForm({
            name: user?.name || '',
            father_name: user?.father_name || '',
            date_of_birth: user?.date_of_birth || '',
            address: user?.address || '',
            city: user?.city || '',
          })
          setLocked({
            role: user?.role || '',
            email: user?.email || '',
            cnic: user?.cnic || '',
            staff_code: user?.staff_code || '',
            phone: user?.phone || '',
            gender: user?.gender || '',
            photo_url: user?.photo_url || '',
          })
        }
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }

    loadFromDb()
    return () => {
      cancelled = true
    }
  }, [open])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function clearPhoto(e) {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    setPhotoFile(null)
    setRemovePhoto(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  function onPickPhoto(e) {
    const file = e.target.files?.[0] || null
    if (file && !isWithinUploadLimit(file)) {
      toast.error(uploadTooLargeMessage('Photo'))
      e.target.value = ''
      return
    }
    setPhotoFile(file)
    if (file) setRemovePhoto(false)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('father_name', form.father_name.trim())
      if (form.date_of_birth) fd.append('date_of_birth', form.date_of_birth)
      fd.append('address', form.address.trim())
      fd.append('city', form.city.trim())
      if (photoFile) fd.append('photo', photoFile)
      if (removePhoto && !photoFile) fd.append('remove_photo', '1')

      const data = await api('/me/profile', { method: 'POST', body: fd })
      toast.success(data.message || 'Profile updated')
      await refreshUser?.(data.user)
      onClose?.()
    } catch (err) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const hasPhoto = Boolean(previewUrl)

  return (
    <Modal
      open={open}
      title="My profile"
      onClose={onClose}
      confirm
      confirmLabel={saving ? 'Saving…' : 'Save'}
      cancelLabel="Cancel"
      onConfirm={handleSave}
      size="md"
    >
      <div className="form-grid">
        <div className="profile-edit-photo-wrap">
          <div className="profile-edit-photo-box">
            <button
              type="button"
              className="profile-edit-photo"
              title={hasPhoto ? 'Change picture' : 'Add picture'}
              onClick={() => fileRef.current?.click()}
            >
              {hasPhoto ? (
                <img src={previewUrl} alt="" className="profile-edit-photo-img is-face" />
              ) : (
                <div className="profile-edit-photo-empty">
                  <Camera size={22} />
                </div>
              )}
            </button>

            {hasPhoto ? (
              <button
                type="button"
                className="profile-edit-photo-clear"
                aria-label="Remove picture"
                title="Remove picture"
                onClick={clearPhoto}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            ) : null}

            <input
              ref={fileRef}
              className="profile-edit-photo-input-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickPhoto}
            />
          </div>
        </div>

        {loadingProfile ? (
          <p className="panel-copy full">Loading profile…</p>
        ) : (
          <div className="profile-edit-fields">
            <div className="ui-field">
              <label htmlFor="prof_name">Name</label>
              <input
                id="prof_name"
                className="ui-input"
                required
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="prof_father">Father name</label>
              <input
                id="prof_father"
                className="ui-input"
                value={form.father_name}
                onChange={(e) => setField('father_name', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="prof_dob">Date of birth</label>
              <input
                id="prof_dob"
                className="ui-input"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setField('date_of_birth', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="prof_address">Address</label>
              <input
                id="prof_address"
                className="ui-input"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </div>
            <div className="ui-field">
              <label htmlFor="prof_city">City</label>
              <input
                id="prof_city"
                className="ui-input"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
              />
            </div>

            <LockedField label="Staff code" value={locked.staff_code} />
            <LockedField label="Role" value={locked.role} />
            <LockedField label="Email" value={locked.email} />
            <LockedField label="CNIC" value={locked.cnic} />
            <LockedField label="Phone" value={locked.phone} />
            <LockedField label="Gender" value={locked.gender} />
          </div>
        )}
      </div>
    </Modal>
  )
}
