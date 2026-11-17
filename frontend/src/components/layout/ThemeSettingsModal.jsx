import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { applyTheme, readTheme } from '../../lib/theme'
import Modal from '../ui/Modal'
import '../../pages/pages.css'

export default function ThemeSettingsModal({ open, onClose }) {
  const { user } = useAuth()
  const [theme, setTheme] = useState(() => readTheme(user))

  useEffect(() => {
    if (open) setTheme(readTheme(user))
  }, [open, user])

  function onPick(next) {
    setTheme(next)
    applyTheme(next, user)
  }

  return (
    <Modal open={open} title="Settings" onClose={onClose} hideFooter size="sm">
      <div className="theme-toggle-row">
        <button
          type="button"
          className={`theme-option ${theme === 'light' ? 'is-active' : ''}`}
          onClick={() => onPick('light')}
        >
          <span className="theme-option-title">Light</span>
          <span className="theme-option-meta">Bright interface</span>
        </button>
        <button
          type="button"
          className={`theme-option ${theme === 'dark' ? 'is-active' : ''}`}
          onClick={() => onPick('dark')}
        >
          <span className="theme-option-title">Dark</span>
          <span className="theme-option-meta">Low-light interface</span>
        </button>
      </div>
    </Modal>
  )
}
