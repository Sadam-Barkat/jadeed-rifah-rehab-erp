import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function toInputDate(d) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lastDayOfMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate()
}

/**
 * Resolve range while keeping year/month/date selections together.
 * Priority: date > year+month > year > 7d > all (default overall data).
 */
export function resolveFilter(filter = {}) {
  const year = filter.year || ''
  const month = filter.month || ''
  const date = filter.date || ''
  const mode = filter.mode || 'all'
  const minYear = filter.minYear || year || String(new Date().getFullYear())
  const created_by = filter.created_by || ''
  const spent_for = filter.spent_for || ''
  const bill_type = filter.bill_type || ''

  if (date) {
    return {
      mode: 'date',
      from: date,
      to: date,
      year,
      month,
      date,
      created_by,
      spent_for,
      bill_type,
      minYear,
      label: `Date: ${date}`,
    }
  }

  if (year && month) {
    const last = String(lastDayOfMonth(year, month)).padStart(2, '0')
    return {
      mode: 'month',
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${last}`,
      year,
      month,
      date: '',
      created_by,
      spent_for,
      bill_type,
      minYear,
      label: `${MONTHS.find((m) => m.value === month)?.label || month} ${year}`,
    }
  }

  if (year) {
    const y = Number(year)
    const nowY = new Date().getFullYear()
    const to = y === nowY ? toInputDate(new Date()) : `${year}-12-31`
    return {
      mode: 'year',
      from: `${year}-01-01`,
      to,
      year,
      month: '',
      date: '',
      created_by,
      spent_for,
      bill_type,
      minYear,
      label: `Year ${year}`,
    }
  }

  if (mode === '7d') {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 6)
    return {
      mode: '7d',
      from: toInputDate(from),
      to: toInputDate(to),
      year: '',
      month: '',
      date: '',
      created_by,
      spent_for,
      bill_type,
      minYear,
      label: 'Last 7 days',
    }
  }

  return {
    mode: 'all',
    from: `${minYear}-01-01`,
    to: toInputDate(new Date()),
    year: '',
    month: '',
    date: '',
    created_by,
    spent_for,
    bill_type,
    minYear,
    label: 'All time',
  }
}

export function defaultRange() {
  return resolveFilter({ mode: 'all', minYear: String(new Date().getFullYear()) })
}

export default function DateRangeFilter({
  value,
  years = [],
  onApply,
  loading,
  showStaff = false,
  staffOptions = [],
  staffLabel = 'Entered by',
  showSpentFor = false,
  spentForOptions = [],
  showBillType = false,
  billTypeOptions = [],
}) {
  const current = value || defaultRange()
  const [mode, setMode] = useState(current.mode || 'all')
  const [year, setYear] = useState(current.year || '')
  const [month, setMonth] = useState(current.month || '')
  const [date, setDate] = useState(current.date || '')
  const [createdBy, setCreatedBy] = useState(current.created_by || '')
  const [spentFor, setSpentFor] = useState(current.spent_for || '')
  const [billType, setBillType] = useState(current.bill_type || '')
  const [yearOptions, setYearOptions] = useState(years)
  const [minYear, setMinYear] = useState(current.minYear || String(new Date().getFullYear()))

  useEffect(() => {
    setMode(current.mode || 'all')
    setYear(current.year || '')
    setMonth(current.month || '')
    setDate(current.date || '')
    setCreatedBy(current.created_by || '')
    setSpentFor(current.spent_for || '')
    setBillType(current.bill_type || '')
    if (current.minYear) setMinYear(current.minYear)
  }, [current.year, current.month, current.date, current.mode, current.minYear, current.created_by, current.spent_for, current.bill_type])

  useEffect(() => {
    let alive = true
    async function loadYears() {
      try {
        const res = await api('/reports/filter-meta')
        const list = Array.isArray(res.data?.years) ? res.data.years.map(String) : []
        if (!alive) return
        if (list.length) {
          setYearOptions(list)
          const earliest = list[0]
          setMinYear(earliest)
          // First load: if still on default all with this-year min, expand to overall data.
          if ((!value || value.mode === 'all') && (!value?.year && !value?.month && !value?.date)) {
            const next = resolveFilter({
              mode: 'all',
              minYear: earliest,
              created_by: createdBy,
              spent_for: spentFor,
              bill_type: billType,
            })
            setMode('all')
            onApply?.(next)
          }
        }
      } catch {
        if (alive && (!years || !years.length)) {
          setYearOptions([String(new Date().getFullYear())])
        }
      }
    }
    if (!years?.length) loadYears()
    else {
      const list = years.map(String)
      setYearOptions(list)
      if (list.length) setMinYear(list[0])
    }
    return () => {
      alive = false
    }
  }, [])

  function push(partial) {
    const next = resolveFilter({
      created_by: createdBy,
      spent_for: spentFor,
      bill_type: billType,
      ...partial,
      minYear,
    })
    setMode(next.mode)
    setYear(next.year || '')
    setMonth(next.month || '')
    setDate(next.date || '')
    setCreatedBy(next.created_by || '')
    setSpentFor(next.spent_for || '')
    setBillType(next.bill_type || '')
    onApply?.(next)
  }

  function onYearChange(y) {
    if (!y) {
      // Keep month/date only if clearing year → overall (or keep date if set)
      push({
        mode: 'all',
        year: '',
        month: '',
        date,
        created_by: createdBy,
        spent_for: spentFor,
        bill_type: billType,
      })
      return
    }
    push({
      mode: month ? 'month' : 'year',
      year: y,
      month,
      date,
      created_by: createdBy,
      spent_for: spentFor,
      bill_type: billType,
    })
  }

  function onMonthChange(m) {
    if (!year && m) return
    push({
      mode: m ? 'month' : 'year',
      year,
      month: m,
      date,
      created_by: createdBy,
      spent_for: spentFor,
      bill_type: billType,
    })
  }

  function onDateChange(d) {
    // Keep year + month selected in UI while applying date range
    push({
      mode: d ? 'date' : year ? (month ? 'month' : 'year') : 'all',
      year,
      month,
      date: d,
      created_by: createdBy,
      spent_for: spentFor,
      bill_type: billType,
    })
  }

  function onStaffChange(id) {
    push({ mode, year, month, date, created_by: id, spent_for: spentFor, bill_type: billType })
  }

  function onSpentForChange(name) {
    push({ mode, year, month, date, created_by: createdBy, spent_for: name, bill_type: billType })
  }

  function onBillTypeChange(type) {
    push({ mode, year, month, date, created_by: createdBy, spent_for: spentFor, bill_type: type })
  }

  function apply7d() {
    push({
      mode: '7d',
      year: '',
      month: '',
      date: '',
      created_by: createdBy,
      spent_for: spentFor,
      bill_type: billType,
    })
  }

  function reset() {
    push({ mode: 'all', year: '', month: '', date: '', created_by: '', spent_for: '', bill_type: '' })
  }

  return (
    <div className="date-filter" role="group" aria-label="Date filter">
      <label className={`date-filter-field ${year ? 'is-active' : ''}`}>
        <span>Year</span>
        <select
          className="ui-select"
          value={year}
          disabled={loading}
          onChange={(e) => onYearChange(e.target.value)}
        >
          <option value="">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className={`date-filter-field ${month ? 'is-active' : ''}`}>
        <span>Month</span>
        <select
          className="ui-select"
          value={month}
          disabled={loading || !year}
          onChange={(e) => onMonthChange(e.target.value)}
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className={`date-filter-field ${date ? 'is-active' : ''}`}>
        <span>Date</span>
        <input
          type="date"
          className="ui-input"
          value={date}
          disabled={loading}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </label>

      {showSpentFor ? (
        <label className={`date-filter-field ${spentFor ? 'is-active' : ''}`}>
          <span>Spent for</span>
          <select
            className="ui-select"
            value={spentFor}
            disabled={loading}
            onChange={(e) => onSpentForChange(e.target.value)}
            aria-label="Spent for filter"
          >
            <option value="">All names</option>
            {spentForOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showBillType ? (
        <label className={`date-filter-field ${billType ? 'is-active' : ''}`}>
          <span>Bill type</span>
          <select
            className="ui-select"
            value={billType}
            disabled={loading}
            onChange={(e) => onBillTypeChange(e.target.value)}
            aria-label="Bill type filter"
          >
            <option value="">All types</option>
            {billTypeOptions.map((opt) => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showStaff ? (
        <label className={`date-filter-field ${createdBy ? 'is-active' : ''}`}>
          <span>{staffLabel}</span>
          <select
            className="ui-select"
            value={createdBy}
            disabled={loading}
            onChange={(e) => onStaffChange(e.target.value)}
            aria-label={staffLabel}
          >
            <option value="">All</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={`date-filter-field date-filter-action-field ${mode === '7d' ? 'is-active' : ''}`}>
        <span>&nbsp;</span>
        <button
          type="button"
          className={`ui-btn ui-btn-ghost ui-btn-md date-filter-btn ${mode === '7d' ? 'is-pressed' : ''}`}
          disabled={loading}
          onClick={apply7d}
        >
          7 days
        </button>
      </label>

      <label className="date-filter-field date-filter-action-field">
        <span>&nbsp;</span>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-md date-filter-btn"
          disabled={loading}
          onClick={reset}
        >
          Reset
        </button>
      </label>
    </div>
  )
}
