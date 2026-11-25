import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../lib/api'

function medLabel(med) {
  const bits = [
    med.name,
    med.strength || null,
    med.form || null,
    med.unit ? `(${med.unit})` : null,
  ].filter(Boolean)
  return bits.join(' · ')
}

export default function MedicineTypeahead({
  id,
  value = '',
  medicineId = '',
  selectedLabel = '',
  onPick,
  onClear,
  disabled = false,
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState(selectedLabel || value || '')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [menuStyle, setMenuStyle] = useState({})
  const picked = Boolean(medicineId)

  useEffect(() => {
    if (picked && selectedLabel) setQuery(selectedLabel)
  }, [picked, selectedLabel])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open || picked || debounced.length < 2) {
      setItems([])
      return undefined
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const q = new URLSearchParams({
          status: 'active',
          search: debounced,
          per_page: '20',
        })
        const res = await api(`/medicines?${q}`)
        if (!cancelled) setItems(res.data || [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [debounced, open, picked])

  function placeMenu() {
    const rect = inputRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.max(rect.width, 220)
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const openUp = spaceBelow < 160 && rect.top > spaceBelow
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width,
      maxHeight: Math.min(220, openUp ? rect.top - 8 : spaceBelow),
      zIndex: 13050,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
    })
  }

  useEffect(() => {
    if (!open || picked) return undefined
    placeMenu()
    function onDoc(e) {
      if (rootRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onScroll(e) {
      if (listRef.current && (e.target === listRef.current || listRef.current.contains(e.target))) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    window.addEventListener('resize', placeMenu)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      window.removeEventListener('resize', placeMenu)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, picked, items.length])

  function pick(med) {
    onPick?.(med)
    setQuery(medLabel(med))
    setOpen(false)
    setItems([])
  }

  function handleChange(next) {
    setQuery(next)
    if (picked) onClear?.()
    setOpen(true)
  }

  const showEmpty = open && !picked && !loading && debounced.length >= 2 && items.length === 0

  const menu = open && !picked
    ? createPortal(
        <div
          ref={listRef}
          className="inventory-dropdown-options inventory-dropdown-options-portal"
          role="listbox"
          style={menuStyle}
        >
          {loading ? (
            <div className="inventory-dropdown-empty">Searching…</div>
          ) : items.length === 0 ? (
            <div className="inventory-dropdown-empty">No matches</div>
          ) : (
            items.map((med) => (
              <button
                key={med.id}
                type="button"
                className="inventory-dropdown-option"
                role="option"
                onClick={() => pick(med)}
              >
                {medLabel(med)}
              </button>
            ))
          )}
        </div>,
        document.body
      )
    : null

  return (
    <div className="medicine-typeahead" ref={rootRef}>
      <input
        ref={inputRef}
        id={fieldId}
        className="ui-input"
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder="Type medicine name"
        onFocus={() => {
          if (!picked) setOpen(true)
        }}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {menu}
      {showEmpty ? (
        <p className="medicine-typeahead-miss">This medicine is not available</p>
      ) : null}
    </div>
  )
}
