import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Mail, MailOpen } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import './layout.css'

/** Absolute Pakistan-friendly datetime, e.g. "18 Nov, 02:57 pm" */
function timeLabel(value) {
  if (!value) return ''
  const raw = String(value).trim()
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return raw
  const day = d.toLocaleString('en-GB', { day: '2-digit', month: 'short' })
  const time = d
    .toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase()
  return `${day}, ${time}`
}

function SenderAvatar({ sender }) {
  const name = sender?.name || 'System'
  const initial = sender?.initial || name.charAt(0).toUpperCase() || 'S'
  if (sender?.photo_url) {
    return <img src={sender.photo_url} alt="" className="notif-avatar-img" />
  }
  return <span className="notif-avatar-fallback">{initial}</span>
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)

  async function loadCount() {
    try {
      const data = await api('/notifications/unread-count')
      setUnread(Number(data.unread_count || 0))
    } catch {
      /* ignore poll errors */
    }
  }

  async function loadList() {
    setLoading(true)
    try {
      const data = await api('/notifications?per_page=40')
      setItems(data.data || [])
      setUnread(Number(data.meta?.unread_count || 0))
    } catch (err) {
      toast.error(err.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCount()
    const t = setInterval(loadCount, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    loadList()
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function applyReadLocal(id, updated) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...(updated || {}), is_read: true } : n))
    )
    setUnread((c) => Math.max(0, c - 1))
  }

  async function markRead(id) {
    const data = await api(`/notifications/${id}/read`, { method: 'POST' })
    return data.data
  }

  /** Closed envelope → mark as read only (open envelope, clear count, no navigate). */
  async function markOneRead(e, item) {
    e.stopPropagation()
    if (item.is_read) return
    try {
      const updated = await markRead(item.id)
      applyReadLocal(item.id, updated)
    } catch (err) {
      toast.error(err.message || 'Failed')
    }
  }

  async function markAll() {
    try {
      await api('/notifications/read-all', { method: 'POST' })
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnread(0)
    } catch (err) {
      toast.error(err.message || 'Failed')
    }
  }

  function resolveLink(item) {
    const feePlanId = Number(item?.meta?.fee_plan_id || 0)
    if (feePlanId > 0) return `/app/fee-plans/${feePlanId}`
    const paymentId = Number(item?.meta?.payment_id || 0)
    if (paymentId > 0) return `/app/payments/${paymentId}`
    const patientId = Number(item?.meta?.patient_id || 0)
    const link = String(item?.link || '').trim()
    if (patientId > 0) {
      if (link.includes('billing') || link.includes('fees=create')) {
        return '/app/billing?tab=fees&fees=create'
      }
      if (!link || link.includes('management') || link.includes('admission')) {
        return `/app/admission?patient_id=${patientId}`
      }
    }
    if (link === '/app/billing' || link.endsWith('/billing')) {
      return '/app/billing?tab=fees&fees=create'
    }
    return link || null
  }

  /** Row click: open linked page (replace so Back is one step to home, not notification chain). */
  async function openItem(item) {
    const link = resolveLink(item)
    if (!link) return
    setOpen(false)
    navigate(link, { replace: true })
    if (item.is_read) return
    try {
      const updated = await markRead(item.id)
      applyReadLocal(item.id, updated)
    } catch {
      /* page already opened */
    }
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="ui-icon-btn notif-bell-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="notif-bell-count">{unread > 99 ? '99+' : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong className="notif-panel-title">
              <Mail size={16} strokeWidth={2.1} aria-hidden="true" />
              Notifications
              {unread > 0 ? <span className="notif-head-count">({unread})</span> : null}
            </strong>
            <button type="button" className="notif-mark-all" onClick={markAll} disabled={unread === 0}>
              Mark all as read
            </button>
          </div>
          <div className="notif-panel-list">
            {loading ? (
              <p className="notif-empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notif-empty">No notifications yet</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`notif-item ${item.is_read ? 'is-read' : 'is-unread'}`}
                  role={item.link ? 'button' : undefined}
                  tabIndex={item.link ? 0 : undefined}
                  onClick={() => openItem(item)}
                  onKeyDown={(e) => {
                    if (!item.link) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openItem(item)
                    }
                  }}
                >
                  <div className="notif-avatar" aria-hidden="true">
                    <SenderAvatar sender={item.sender} />
                    {!item.is_read ? <span className="notif-avatar-dot" /> : null}
                  </div>
                  <div className="notif-item-main">
                    <span className="notif-item-title">{item.title}</span>
                    {item.body ? <span className="notif-item-body">{item.body}</span> : null}
                    <span className="notif-item-from">
                      <span className="notif-dept">
                        {item.department || item.sender?.department || 'System'}
                      </span>
                      {item.sender?.name ? ` · ${item.sender.name}` : ''}
                    </span>
                    <span className="notif-item-time">{timeLabel(item.created_at)}</span>
                  </div>
                  <button
                    type="button"
                    className={`notif-mark-one ${item.is_read ? 'is-open' : 'is-closed'}`}
                    title={item.is_read ? 'Opened' : 'Mark as read'}
                    aria-label={item.is_read ? 'Opened' : 'Mark as read'}
                    onClick={(e) => markOneRead(e, item)}
                  >
                    {item.is_read ? (
                      <MailOpen size={18} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Mail size={18} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
