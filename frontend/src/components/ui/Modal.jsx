import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from './Button'
import './ui.css'

export default function Modal({
  open,
  title,
  children,
  onClose,
  confirmLabel = 'Confirm',
  cancelLabel = 'Close',
  onConfirm,
  danger = false,
  size = 'md',
  hideFooter = false,
  confirm = false,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClass = size && size !== 'md' ? ` ui-modal-${size}` : ''
  const confirmClass = confirm ? ' ui-modal-confirm' : ''

  return createPortal(
    <div className="ui-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`ui-modal${sizeClass}${confirmClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal-header">
          <h3>{title}</h3>
          <button type="button" className="ui-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {!hideFooter ? (
          <div className="ui-modal-footer">
            <Button variant="ghost" onClick={onClose}>
              {cancelLabel}
            </Button>
            {onConfirm ? (
              <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
