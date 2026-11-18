import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import DashboardView from '../../components/dashboard/DashboardView'
import { defaultRange } from '../../components/dashboard/DateRangeFilter'
import '../pages.css'

const STAFF_SECTIONS = new Set(['pharmacy', 'inventory', 'inventory-petty', 'inventory-bills'])
const PRINT_SECTIONS = new Set(['pharmacy', 'inventory', 'inventory-petty', 'inventory-bills', 'visitors'])
const FINANCE_TABS = new Set(['overview', 'petty', 'bills'])

function sectionForTab(section, financeTab) {
  if (section !== 'finance') return section
  if (financeTab === 'petty') return 'inventory-petty'
  if (financeTab === 'bills') return 'inventory-bills'
  return 'finance'
}

export default function AdminSectionPage({ section, fallbackTitle }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [staffOptions, setStaffOptions] = useState([])
  const [spentForOptions, setSpentForOptions] = useState([])
  const [billTypeOptions, setBillTypeOptions] = useState([])
  const rawFinanceTab = searchParams.get('tab') || 'overview'
  const financeTab = FINANCE_TABS.has(rawFinanceTab) ? rawFinanceTab : 'overview'

  function setFinanceTab(tab) {
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true })
  }

  const activeSection = sectionForTab(section, financeTab)
  const showStaff = STAFF_SECTIONS.has(activeSection)
  const showSpentFor = activeSection === 'inventory-petty'
  const showBillType = activeSection === 'inventory-bills'

  useEffect(() => {
    let alive = true
    async function loadStaff() {
      if (!showStaff && !showSpentFor && !showBillType) {
        setStaffOptions([])
        setSpentForOptions([])
        setBillTypeOptions([])
        return
      }
      try {
        const res = await api('/reports/filter-meta')
        if (!alive) return
        const key =
          section === 'pharmacy'
            ? 'pharmacy_staff'
            : activeSection === 'inventory-petty' || activeSection === 'inventory-bills'
              ? 'finance_staff'
              : 'inventory_staff'
        setStaffOptions(Array.isArray(res.data?.[key]) ? res.data[key] : [])
        setSpentForOptions(Array.isArray(res.data?.petty_spent_for) ? res.data.petty_spent_for : [])
        setBillTypeOptions(Array.isArray(res.data?.facility_bill_types) ? res.data.facility_bill_types : [])
      } catch {
        if (alive) {
          setStaffOptions([])
          setSpentForOptions([])
          setBillTypeOptions([])
        }
      }
    }
    loadStaff()
    return () => {
      alive = false
    }
  }, [section, activeSection, showStaff, showSpentFor, showBillType])

  const load = useCallback(
    async (nextFilter = filter, nextSection = activeSection) => {
      setLoading(true)
      try {
        const q = new URLSearchParams({
          section: nextSection,
          from: nextFilter.from,
          to: nextFilter.to,
        })
        if (STAFF_SECTIONS.has(nextSection) && nextFilter.created_by) {
          q.set('created_by', String(nextFilter.created_by))
        }
        if (nextSection === 'inventory-petty' && nextFilter.spent_for) {
          q.set('spent_for', String(nextFilter.spent_for))
        }
        if (nextSection === 'inventory-bills' && nextFilter.bill_type) {
          q.set('bill_type', String(nextFilter.bill_type))
        }
        const res = await api(`/reports/dashboard?${q}`)
        setData(res.data)
      } catch (err) {
        toast.error(err.message || 'Failed to load overview')
      } finally {
        setLoading(false)
      }
    },
    [filter, activeSection]
  )

  useEffect(() => {
    setFilter((prev) => ({ ...prev, created_by: '', spent_for: '', bill_type: '' }))
    const next = { ...filter, created_by: '', spent_for: '', bill_type: '' }
    load(next, activeSection)
  }, [section, financeTab])

  const tabTitle =
    financeTab === 'petty'
      ? 'Petty expenses'
      : financeTab === 'bills'
        ? 'Facility bills'
        : fallbackTitle

  return (
    <>
      {section === 'finance' ? (
        <div className="page-tabs no-print" role="tablist" aria-label="Billing & finance admin tabs">
          <button
            type="button"
            role="tab"
            className={`page-tab ${financeTab === 'overview' ? 'is-active' : ''}`}
            aria-selected={financeTab === 'overview'}
            onClick={() => setFinanceTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            className={`page-tab ${financeTab === 'petty' ? 'is-active' : ''}`}
            aria-selected={financeTab === 'petty'}
            onClick={() => setFinanceTab('petty')}
          >
            Petty expenses
          </button>
          <button
            type="button"
            role="tab"
            className={`page-tab ${financeTab === 'bills' ? 'is-active' : ''}`}
            aria-selected={financeTab === 'bills'}
            onClick={() => setFinanceTab('bills')}
          >
            Facility bills
          </button>
        </div>
      ) : null}

      <DashboardView
        eyebrow="Admin Dashboard"
        title={data?.title || tabTitle}
        filter={filter}
        onFilterApply={(next) => {
          setFilter(next)
          load(next, activeSection)
        }}
        loading={loading}
        data={data}
        compact
        enablePrint={PRINT_SECTIONS.has(activeSection)}
        showStaffFilter={showStaff}
        staffOptions={staffOptions}
        staffLabel={
          activeSection === 'inventory-petty' || activeSection === 'inventory-bills'
            ? 'Entered by'
            : 'Staff'
        }
        showSpentForFilter={showSpentFor}
        spentForOptions={spentForOptions}
        showBillTypeFilter={showBillType}
        billTypeOptions={billTypeOptions}
      />
    </>
  )
}
