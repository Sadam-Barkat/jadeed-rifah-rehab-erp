import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import './layout.css'

function timeLabel(value) {
  if (!value) return ''
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
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
      const data = await api('/notifications?per_page=30')
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

  async function markRead(id) {
    await api(`/notifications/${id}/read`, { method: 'POST' })
  }

  async function markAll() {
    try {
      await api('/notifications/read-all', { method: 'POST' })
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnread(0)
      toast.success('All marked as read')
    } catch (err) {
      toast.error(err.message || 'Failed')
    }
  }

  async function openItem(item) {
    try {
      if (!item.is_read) {
        await markRead(item.id)
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)))
        setUnread((c) => Math.max(0, c - 1))
      }
    } catch {
      /* still navigate */
    }
    setOpen(false)
    if (item.link) navigate(item.link)
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
            <strong>Notifications</strong>
            <button type="button" className="notif-mark-all" onClick={markAll} disabled={unread === 0}>
              Mark all read
            </button>
          </div>
          <div className="notif-panel-list">
            {loading ? (
              <p className="notif-empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notif-empty">No notifications</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notif-item ${item.is_read ? 'is-read' : 'is-unread'}`}
                  onClick={() => openItem(item)}
                >
                  <span className="notif-item-title">{item.title}</span>
                  {item.body ? <span className="notif-item-body">{item.body}</span> : null}
                  <span className="notif-item-time">{timeLabel(item.created_at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
