import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { formatPkr } from '../../lib/format'
import { printReportTable } from '../../lib/printReport'
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
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (['critical', 'out of stock', 'danger', 'unpaid', 'archived', 'inactive', 'occupied'].includes(v)) return 'badge-danger'
  if (['low', 'low stock', 'warning', 'partial', 'pending', 'registered', 'rejected', 'checked_in'].includes(v)) {
    return 'badge-warn'
  }
  if (
    ['good', 'active', 'paid', 'completed', 'success', 'admitted', 'approved', 'checked_out', 'available'].includes(
      v
    )
  ) {
    return 'badge-ok'
  }
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
    if (!staffCol) return -1
    const preferred = findColumnIndex(columns, staffCol)
    if (preferred >= 0) return preferred
    return columns.findIndex((c) => String(c).toLowerCase().includes('recorded'))
  }, [columns, staffCol])

  const allowTypeFilter = detail?.allow_filter !== false
  const hasNameFilter = detail?.allow_name_filter === true && nameColIndex >= 0 && nameColIndex !== resolvedFilterCol
  const hasStaffFilter =
    staffColIndex >= 0 && staffColIndex !== resolvedFilterCol && staffColIndex !== nameColIndex
  const searchPlaceholder = detail?.search_placeholder || 'Search'

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
  const modalTitle = detail?.title || 'Details'

  return (
    <Modal open={open} title={modalTitle} onClose={onClose} size="md" hideFooter>
      <div className="kpi-modal-sticky">
        <div className="kpi-modal-toolbar">
          <input
            className="ui-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
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
                  {opt === 'all' ? 'All' : opt}
                </option>
              ))}
            </select>
          ) : null}
          {allowTypeFilter && typeOptions.length > 1 ? (
            <select
              className="ui-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter"
            >
              {typeOptions.map((opt) => (
                <option key={`type-${opt}`} value={opt}>
                  {opt === 'all' ? 'All' : opt}
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
                  {opt === 'all' ? 'All' : opt}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="ui-icon-btn kpi-modal-print"
            onClick={() => printReportTable({ title: modalTitle, columns, rows })}
            aria-label="Print"
            title="Print"
          >
            <Printer size={18} />
          </button>
        </div>
        <p className="panel-meta kpi-modal-count">{rows.length} row(s)</p>
      </div>
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
                  {row.map((cell, cIdx) => {
                    const colName = String(columns[cIdx] || '')
                    const isPhoto = colName.toLowerCase() === 'photo' && typeof cell === 'string' && /^https?:\/\//.test(cell)
                    const isBill = colName.toLowerCase() === 'bill' && typeof cell === 'string' && /^https?:\/\//.test(cell)
                    return (
                      <td key={`${idx}-${cIdx}`}>
                        {isPhoto ? (
                          <a href={cell} target="_blank" rel="noreferrer" className="att-photo-link">
                            <img src={cell} alt="Attendance" className="att-photo-thumb" />
                          </a>
                        ) : isBill ? (
                          <a href={cell} target="_blank" rel="noreferrer">View bill</a>
                        ) : (colName.toLowerCase() === 'status' || cIdx === row.length - 1) &&
                          statusClass(cell) ? (
                          <span className={`badge ${statusClass(cell)}`}>{cell}</span>
                        ) : (
                          cell
                        )}
                      </td>
                    )
                  })}
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
  staffLabel = 'Entered by',
  showSpentForFilter = false,
  spentForOptions = [],
  showBillTypeFilter = false,
  billTypeOptions = [],
  enablePrint = false,
}) {
  const [activeDetail, setActiveDetail] = useState(null)
  const kpis = data?.kpis || []
  const showLinks = (data?.links || []).length > 0
  const charts = data?.charts || []
  const presentGallery = data?.present_gallery || null
  const presentItems = Array.isArray(presentGallery?.items) ? presentGallery.items : []
  const cardMode = data?.card_mode || (data?.section === 'overview' ? 'tooltip' : 'modal')
  const enableStaff = showStaffFilter || !!data?.staff_filter
  const rangeLabel =
    filter?.label ||
    (filter?.from && filter?.to ? `${filter.from} – ${filter.to}` : '')

  return (
    <div className={`page dash-page ${compact ? 'dash-compact' : ''} ${enablePrint ? 'print-page' : ''}`}>
      <div className="page-header dash-header no-print">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="page-actions">
          {enablePrint ? (
            <button
              type="button"
              className="ui-btn ui-btn-secondary ui-btn-md"
              onClick={() => window.print()}
              disabled={loading || !data}
            >
              Print
            </button>
          ) : null}
          {headerActions}
        </div>
      </div>

      <div className="dash-filter-row no-print">
        <DateRangeFilter
          value={filter}
          onApply={onFilterApply}
          loading={loading}
          showStaff={enableStaff}
          staffOptions={staffOptions}
          staffLabel={staffLabel}
          showSpentFor={showSpentForFilter}
          spentForOptions={spentForOptions}
          showBillType={showBillTypeFilter}
          billTypeOptions={billTypeOptions}
        />
      </div>

      {loading || !data ? (
        <SkeletonCards count={8} />
      ) : (
        <div className="print-dash-sheet">
          <header className="print-dash-head">
            <p className="print-dash-org">Jadeed Rifah Rehab &amp; Care Center</p>
            <h2>{title}</h2>
            {rangeLabel ? <p>{rangeLabel}</p> : null}
          </header>

          <div className={`stat-grid ${kpis.length >= 8 ? 'stat-grid-4' : kpis.length <= 4 ? 'stat-grid-4' : ''}`}>
            {kpis.map((kpi) => {
              const clickable = cardMode === 'modal' && kpi.detail
              const isAlert = !!kpi.alert
              const tipLines = Array.isArray(kpi.tooltip_lines)
                ? kpi.tooltip_lines.filter((line) => line != null)
                : kpi.tooltip
                  ? [kpi.tooltip]
                  : []
              return (
                <article
                  key={kpi.key || kpi.label}
                  className={`stat-card tone-${kpi.tone || 'blue'} ${clickable ? 'stat-card-clickable' : ''} ${cardMode === 'tooltip' ? 'stat-card-tip' : ''} ${isAlert ? 'stat-card-alert' : ''}`}
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
                    <div
                      className={`stat-card-tooltip ${tipLines.length >= 15 ? 'is-scrollable' : ''}`}
                      role="tooltip"
                    >
                      <ul className="stat-card-tooltip-list">
                        {tipLines.map((line, idx) => {
                          const isGap = line === ''
                          const isHeading = !isGap && !/:\s*\d+\s*$/.test(line)
                          return (
                            <li
                              key={`${kpi.key || kpi.label}-${idx}`}
                              className={isGap ? 'is-gap' : isHeading ? 'is-heading' : undefined}
                            >
                              {line}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : null}
                  <p>{kpi.label}</p>
                  <strong className={Number(kpi.value) < 0 ? 'is-neg' : undefined}>{formatKpi(kpi)}</strong>
                  <span>{kpi.meta}</span>
                  {isAlert && kpi.alert_text ? (
                    <em className="stat-card-alert-msg">{kpi.alert_text}</em>
                  ) : null}
                </article>
              )
            })}
          </div>

          {presentGallery ? (
            <section className="panel present-gallery-panel">
              <div className="panel-head">
                <h3>{presentGallery.title || 'Present today'}</h3>
                <span className="panel-meta">{presentItems.length} staff</span>
              </div>
              {presentItems.length === 0 ? (
                <p className="panel-copy">No staff checked in yet.</p>
              ) : (
                <div className="scroll-panel present-gallery-scroll">
                  <div className="present-gallery-grid">
                    {presentItems.map((item) => (
                      <article key={item.id || `${item.staff_code}-${item.check_in_at}`} className="present-gallery-card">
                        {item.photo_url ? (
                          <a href={item.photo_url} target="_blank" rel="noreferrer" className="present-gallery-photo-wrap">
                            <img src={item.photo_url} alt={item.name || 'Staff'} className="present-gallery-photo" />
                          </a>
                        ) : (
                          <div className="present-gallery-photo is-empty">No photo</div>
                        )}
                        <div className="present-gallery-body">
                          <strong>{item.name || '—'}</strong>
                          <span>{item.role || '—'}</span>
                          <span>{item.staff_code || '—'}</span>
                          <span>{item.phone || '—'}</span>
                          <span>{item.check_in_at || '—'}</span>
                          {item.checked_in_by ? <span>Gate: {item.checked_in_by}</span> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {charts.length ? (
            <div className={`chart-grid ${charts.length === 1 ? 'chart-grid-1' : charts.length === 3 ? 'chart-grid-3' : ''}`}>
              {charts.map((chart) => (
                <BarChart
                  key={chart.id || chart.title}
                  title={chart.title}
                  series={chart.series || []}
                  categories={chart.categories || []}
                  lines={chart.lines || []}
                  type={chart.type || 'bar'}
                />
              ))}
            </div>
          ) : null}

          {showLinks ? (
            <section className="panel no-print">
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
        </div>
      )}

      <DetailModal open={!!activeDetail} detail={activeDetail} onClose={() => setActiveDetail(null)} />
    </div>
  )
}
