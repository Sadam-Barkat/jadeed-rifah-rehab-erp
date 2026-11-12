import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPkr } from '../../lib/format'
import { SkeletonCards } from '../ui/Skeleton'
import Modal from '../ui/Modal'
import BarChart from './BarChart'
import DateRangeFilter from './DateRangeFilter'

function formatKpi(kpi) {
  if (kpi.money) return formatPkr(kpi.value)
  if (kpi.suffix) return `${kpi.value}${kpi.suffix}`
  return String(kpi.value ?? 0)
}

function statusClass(value) {
  const v = String(value || '').toLowerCase()
  if (['critical', 'danger', 'unpaid', 'archived', 'inactive'].includes(v)) return 'badge-danger'
  if (['low', 'warning', 'partial', 'pending', 'registered', 'checked_in'].includes(v)) return 'badge-warn'
  if (['good', 'active', 'paid', 'completed', 'success', 'admitted', 'checked_out'].includes(v)) return 'badge-ok'
  return ''
}

function findColumnIndex(columns, preferred) {
  if (typeof preferred === 'number') return preferred
  if (preferred) {
    const exact = columns.findIndex((c) => String(c).toLowerCase() === String(preferred).toLowerCase())
    if (exact >= 0) return exact
  }
  return -1
}

function DetailModal({ open, detail, onClose }) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [nameFilter, setNameFilter] = useState('all')
  const [staffFilter, setStaffFilter] = useState('all')
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setTypeFilter('all')
    setNameFilter('all')
    setStaffFilter('all')
  }, [open, detail?.title])

  const filterCol = detail?.filter_column ?? detail?.filterColumn
  const staffCol = detail?.staff_filter_column ?? detail?.staffFilterColumn
  const nameCol = detail?.name_filter_column ?? detail?.nameFilterColumn
  const columns = detail?.columns || []
  const colIndex = findColumnIndex(columns, filterCol)
  const resolvedFilterCol = colIndex >= 0 ? colIndex : Math.max(0, columns.length - 1)

  const nameColIndex = useMemo(() => {
    const preferred = findColumnIndex(columns, nameCol)
    if (preferred >= 0) return preferred
    const priority = ['name', 'medicine', 'item', 'patient', 'person']
    for (const key of priority) {
      const idx = columns.findIndex((c) => String(c).toLowerCase() === key)
      if (idx >= 0) return idx
    }
    return -1
  }, [columns, nameCol])

  const staffColIndex = useMemo(() => {
    const preferred = findColumnIndex(columns, staffCol || 'Recorded by')
    if (preferred >= 0) return preferred
    return columns.findIndex((c) => String(c).toLowerCase().includes('recorded'))
  }, [columns, staffCol])

  const hasNameFilter = nameColIndex >= 0 && nameColIndex !== resolvedFilterCol
  const hasStaffFilter = staffColIndex >= 0 && staffColIndex !== resolvedFilterCol && staffColIndex !== nameColIndex

  const uniqueValues = (index) => {
    const values = new Set()
    ;(detail?.rows || []).forEach((row) => {
      const v = String(row?.[index] ?? '').trim()
      if (v && v !== '—') values.add(v)
    })
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }

  const typeOptions = useMemo(() => uniqueValues(resolvedFilterCol), [detail, resolvedFilterCol])
  const nameOptions = useMemo(
    () => (hasNameFilter ? uniqueValues(nameColIndex) : ['all']),
    [detail, hasNameFilter, nameColIndex]
  )
  const staffOptions = useMemo(
    () => (hasStaffFilter ? uniqueValues(staffColIndex) : ['all']),
    [detail, hasStaffFilter, staffColIndex]
  )

  const rows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return (detail?.rows || []).filter((row) => {
      if (typeFilter !== 'all' && String(row?.[resolvedFilterCol] ?? '') !== typeFilter) return false
      if (hasNameFilter && nameFilter !== 'all' && String(row?.[nameColIndex] ?? '') !== nameFilter) return false
      if (hasStaffFilter && staffFilter !== 'all' && String(row?.[staffColIndex] ?? '') !== staffFilter) return false
      if (!q) return true
      return row.some((cell) => String(cell ?? '').toLowerCase().includes(q))
    })
  }, [
    detail,
    deferredQuery,
    typeFilter,
    nameFilter,
    staffFilter,
    resolvedFilterCol,
    hasNameFilter,
    nameColIndex,
    hasStaffFilter,
    staffColIndex,
  ])

  const nameLabel = hasNameFilter ? String(columns[nameColIndex] || 'Name') : 'Name'

  return (
    <Modal open={open} title={detail?.title || 'Details'} onClose={onClose} size="xl" hideFooter>
      <div className="kpi-modal-toolbar">
        <input
          className="ui-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search"
        />
        {hasNameFilter && nameOptions.length > 1 ? (
          <select
            className="ui-select"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            aria-label={`${nameLabel} filter`}
          >
            {nameOptions.map((opt) => (
              <option key={`name-${opt}`} value={opt}>
                {opt === 'all' ? `All ${nameLabel.toLowerCase()}s` : opt}
              </option>
            ))}
          </select>
        ) : null}
        {typeOptions.length > 1 ? (
          <select
            className="ui-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter"
          >
            {typeOptions.map((opt) => (
              <option key={`type-${opt}`} value={opt}>
                {opt === 'all'
                  ? (staffColIndex === resolvedFilterCol ? 'All staff' : 'All')
                  : opt}
              </option>
            ))}
          </select>
        ) : null}
        {hasStaffFilter && staffOptions.length > 1 ? (
          <select
            className="ui-select"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            aria-label="Staff filter"
          >
            {staffOptions.map((opt) => (
              <option key={`staff-${opt}`} value={opt}>
                {opt === 'all' ? 'All staff' : opt}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <p className="panel-meta kpi-modal-count">{rows.length} row(s)</p>
      {rows.length === 0 ? (
        <p className="panel-copy">No rows</p>
      ) : (
        <div className="scroll-panel dash-scroll-panel kpi-modal-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${detail?.title}-${idx}`}>
                  {row.map((cell, cIdx) => (
                    <td key={`${idx}-${cIdx}`}>
                      {cIdx === row.length - 1 && statusClass(cell) ? (
                        <span className={`badge ${statusClass(cell)}`}>{cell}</span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export default function DashboardView({
  eyebrow,
  title,
  filter,
  onFilterApply,
  loading,
  data,
  headerActions,
  compact = false,
  showStaffFilter = false,
  staffOptions = [],
}) {
  const [activeDetail, setActiveDetail] = useState(null)
  const kpis = data?.kpis || []
  const showLinks = (data?.links || []).length > 0
  const charts = data?.charts || []
  const cardMode = data?.card_mode || (data?.section === 'overview' ? 'tooltip' : 'modal')
  const enableStaff = showStaffFilter || !!data?.staff_filter

  return (
    <div className={`page dash-page ${compact ? 'dash-compact' : ''}`}>
      <div className="page-header dash-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="page-actions dash-header-actions">
          <DateRangeFilter
            value={filter}
            onApply={onFilterApply}
            loading={loading}
            showStaff={enableStaff}
            staffOptions={staffOptions}
          />
          {headerActions}
        </div>
      </div>

      {loading || !data ? (
        <SkeletonCards count={8} />
      ) : (
        <>
          <div className={`stat-grid ${kpis.length >= 8 ? 'stat-grid-4' : kpis.length <= 4 ? 'stat-grid-4' : ''}`}>
            {kpis.map((kpi) => {
              const clickable = cardMode === 'modal' && kpi.detail
              const tipLines = Array.isArray(kpi.tooltip_lines)
                ? kpi.tooltip_lines.filter(Boolean)
                : kpi.tooltip
                  ? [kpi.tooltip]
                  : []
              return (
                <article
                  key={kpi.key || kpi.label}
                  className={`stat-card tone-${kpi.tone || 'blue'} ${clickable ? 'stat-card-clickable' : ''} ${cardMode === 'tooltip' ? 'stat-card-tip' : ''}`}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => setActiveDetail(kpi.detail) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setActiveDetail(kpi.detail)
                          }
                        }
                      : undefined
                  }
                >
                  {cardMode === 'tooltip' && tipLines.length ? (
                    <div className="stat-card-tooltip" role="tooltip">
                      <ul className="stat-card-tooltip-list">
                        {tipLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p>{kpi.label}</p>
                  <strong>{formatKpi(kpi)}</strong>
                  <span>{kpi.meta}</span>
                </article>
              )
            })}
          </div>

          {charts.length ? (
            <div className={`chart-grid ${charts.length === 1 ? 'chart-grid-1' : charts.length === 3 ? 'chart-grid-3' : ''}`}>
              {charts.map((chart) => (
                <BarChart key={chart.id || chart.title} title={chart.title} series={chart.series || []} />
              ))}
            </div>
          ) : null}

          {showLinks ? (
            <section className="panel">
              <div className="panel-head">
                <h3>Quick actions</h3>
              </div>
              <div className="role-home-links">
                {data.links.map((link) => (
                  <Link key={link.to} className="role-home-link" to={link.to}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <DetailModal open={!!activeDetail} detail={activeDetail} onClose={() => setActiveDetail(null)} />
    </div>
  )
}
