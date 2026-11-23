import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

/** Scrollable combobox; list portals above overflow parents. */
export default function ScrollSelect({
  id,
  value,
  options = [],
  onChange,
  placeholder = 'Select',
  disabled = false,
  required = false,
  searchable = false,
  allowCreate = false,
  createLabel = 'Add',
}) {
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState({})
  const selectedOption = options.find((option) => String(option.value) === String(value))
  const displayLabel = selectedOption?.label || (value && value !== '__new__' ? String(value) : '') || placeholder

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => String(option.label || '').toLowerCase().includes(q))
  }, [options, query])

  const canCreate = allowCreate && query.trim() && !options.some(
    (option) => String(option.value).toLowerCase() === query.trim().toLowerCase()
      || String(option.label).toLowerCase() === query.trim().toLowerCase()
  )

  function placeMenu() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    const boundEl = triggerRef.current?.closest('.ui-modal, .panel, form')
    const box = boundEl?.getBoundingClientRect()
    const pad = 8
    const gap = 4

    const boundTop = box ? box.top + pad : 8
    const boundBottom = box ? box.bottom - pad : window.innerHeight - 8
    const boundLeft = box ? box.left + pad : 8
    const boundRight = box ? box.right - pad : window.innerWidth - 8

    const spaceBelow = Math.max(0, boundBottom - rect.bottom - gap)
    const spaceAbove = Math.max(0, rect.top - boundTop - gap)
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow
    const available = openUp ? spaceAbove : spaceBelow
    const maxHeight = Math.max(96, Math.min(searchable ? 260 : 220, available))
    const width = Math.min(Math.max(rect.width, 160), Math.max(120, boundRight - boundLeft))
    const left = Math.min(Math.max(boundLeft, rect.left), Math.max(boundLeft, boundRight - width))

    setMenuStyle({
      position: 'fixed',
      left,
      width,
      maxHeight,
      zIndex: 13050,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap, top: 'auto' }
        : { top: rect.bottom + gap, bottom: 'auto' }),
    })
  }

  useLayoutEffect(() => {
    if (!open) return undefined
    placeMenu()
    return undefined
  }, [open, options.length, filteredOptions.length, query])

  useEffect(() => {
    if (!open) return undefined
    setQuery('')
    // Ignore ancestor scroll briefly — focusing search often scrolls overflow parents and would close instantly.
    let ignoreScrollUntil = Date.now() + 250
    const focusTimer = window.setTimeout(() => {
      if (searchable) {
        ignoreScrollUntil = Date.now() + 250
        searchRef.current?.focus({ preventScroll: true })
      }
    }, 0)

    function closeOutside(event) {
      const t = event.target
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }

    function onScroll(event) {
      const t = event.target
      if (listRef.current && (t === listRef.current || listRef.current.contains(t))) return
      if (Date.now() < ignoreScrollUntil) {
        placeMenu()
        return
      }
      setOpen(false)
    }

    function onResize() {
      placeMenu()
    }

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', closeOutside)
    }, 0)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)

    return () => {
      window.clearTimeout(focusTimer)
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, searchable])

  function toggle(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if (disabled) return
    if (open) {
      setOpen(false)
      return
    }
    placeMenu()
    setOpen(true)
  }

  function pick(nextValue) {
    onChange?.(String(nextValue))
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  function handleOptionKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const optionButtons = Array.from(
      listRef.current?.querySelectorAll('.inventory-dropdown-option:not(:disabled)') || []
    )
    if (!optionButtons.length) return

    const currentIndex = optionButtons.indexOf(document.activeElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? optionButtons.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + optionButtons.length) % optionButtons.length
    optionButtons[nextIndex]?.focus()
  }

  const menu = open
    ? createPortal(
        <div
          ref={listRef}
          id={`${id}-options`}
          className="inventory-dropdown-options inventory-dropdown-options-portal"
          role="listbox"
          style={menuStyle}
        >
          {searchable ? (
            <div className="inventory-dropdown-search" onPointerDown={(e) => e.stopPropagation()}>
              <input
                ref={searchRef}
                className="ui-input"
                type="search"
                value={query}
                placeholder={allowCreate ? 'Search or type to add…' : 'Search…'}
                aria-label="Search options"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false)
                    triggerRef.current?.focus()
                  }
                  if (e.key === 'Enter' && canCreate) {
                    e.preventDefault()
                    pick(query.trim())
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    listRef.current?.querySelector('.inventory-dropdown-option:not(:disabled)')?.focus()
                  }
                }}
              />
            </div>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              className="inventory-dropdown-option is-create"
              role="option"
              onClick={() => pick(query.trim())}
              onKeyDown={handleOptionKeyDown}
            >
              {createLabel} “{query.trim()}”
            </button>
          ) : null}
          {filteredOptions.length === 0 && !canCreate ? (
            <div className="inventory-dropdown-empty">
              {allowCreate ? 'Type a name to add' : 'No matches'}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className="inventory-dropdown-option"
                role="option"
                aria-selected={String(option.value) === String(value)}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return
                  pick(option.value)
                }}
                onKeyDown={handleOptionKeyDown}
              >
                {option.label}
              </button>
            ))
          )}
        </div>,
        document.body
      )
    : null

  return (
    <div className={`inventory-dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="ui-select inventory-dropdown-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-required={required || undefined}
        disabled={disabled}
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              toggle(event)
              return
            }
            listRef.current?.querySelector('.inventory-dropdown-option:not(:disabled)')?.focus()
          }
        }}
      >
        <span>{displayLabel}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {menu}
    </div>
  )
}
