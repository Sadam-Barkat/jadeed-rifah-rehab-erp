import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { MODULES } from '../../data/modules'
import { isClinicalDoctor } from '../../lib/clinicalDoctors'
import { ROLE_HOME_PATH } from '../../lib/roleHomes'
import NotificationBell from './NotificationBell'
import ProfileEditModal from './ProfileEditModal'
import ThemeSettingsModal from './ThemeSettingsModal'
import './layout.css'

const FINANCE_TABS = [
  { to: '/app/billing?tab=fees', label: 'Fees & payments', match: 'fees' },
  { to: '/app/billing?tab=petty', label: 'Petty expenses', match: 'petty' },
  { to: '/app/billing?tab=bills', label: 'Facility bills', match: 'bills' },
]

const RECEPTION_TABS = [
  { to: '/app/reception?tab=register', label: 'Register', match: 'register' },
  { to: '/app/reception?tab=pending', label: 'Pending', match: 'pending' },
  { to: '/app/reception?tab=assign', label: 'Assign bed', match: 'assign' },
  { to: '/app/reception?tab=admitted', label: 'Admitted', match: 'admitted' },
]

const GATE_TABS = [
  { to: '/app/visitors?tab=attendance', label: 'Staff Attendance', match: 'attendance' },
  { to: '/app/visitors?tab=visitors', label: 'Visitors', match: 'visitors' },
]

const INVENTORY_TABS = [
  { to: '/app/inventory?tab=use', label: 'Use Stock', match: 'use' },
  { to: '/app/inventory?tab=receive', label: 'Receive Stock', match: 'receive' },
  { to: '/app/inventory?tab=levels', label: 'Stock Levels', match: 'levels' },
  { to: '/app/inventory?tab=discard', label: 'Discard', match: 'discard' },
]

const DISPENSER_TABS = [
  { to: '/app/pharmacy?tab=prescriptions', label: 'Prescriptions', match: 'prescriptions' },
  { to: '/app/pharmacy?tab=drafts', label: 'Drafts', match: 'drafts' },
  { to: '/app/pharmacy?tab=receive', label: 'Receive Stock', match: 'receive' },
  { to: '/app/pharmacy?tab=levels', label: 'Stock Levels', match: 'levels' },
  { to: '/app/pharmacy?tab=expired', label: 'Expired', match: 'expired' },
]

const NURSE_TABS = [
  { to: '/app/nursing?tab=slips', label: 'Medicine slips', match: 'slips' },
  { to: '/app/nursing?tab=given', label: 'Given', match: 'given' },
  { to: '/app/nursing?tab=vitals', label: 'Vitals', match: 'vitals' },
]

const DOCTOR_TABS = [
  { to: '/app/doctors?tab=vitals', label: 'Vitals', match: 'vitals' },
  { to: '/app/doctors?tab=prescribe', label: 'Prescribe', match: 'prescribe' },
  { to: '/app/doctors?tab=rounds', label: 'Rounds', match: 'rounds' },
]

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function navItemsForUser(user) {
  const allowed = new Set(user?.modules || [])
  const items = MODULES.filter((m) => allowed.has(m.id)).map((m) => ({
    id: m.id,
    label: m.name,
    to: m.path,
  }))

  const home = ROLE_HOME_PATH[user?.role_slug]
  if (
    home &&
    home.includes('/home/') &&
    !items.some((i) => i.to === home)
  ) {
    items.unshift({ id: 'home', label: 'Home', to: home })
  }

  return items
}

export default function RoleTopNav({ onLogoutClick }) {
  const { user } = useAuth()
  const location = useLocation()
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const isFinance = user?.role_slug === 'finance'
  const isReception = user?.role_slug === 'receptionist'
  const isGate = user?.role_slug === 'gatekeeper'
  const isInventoryManager = user?.role_slug === 'inventory-manager'
  const isCook = user?.role_slug === 'cook'
  const isDispenser = user?.role_slug === 'dispenser' || user?.role_slug === 'pharmacist'
  const isNurse = user?.role_slug === 'nurse'
  const isDoctor = isClinicalDoctor(user)
  const isPsychologist = user?.role_slug === 'clinical-psychologist'
  const isMaulana = user?.role_slug === 'maulana'
  const items = useMemo(
    () => (isFinance || isReception || isGate || isInventoryManager || isCook || isDispenser || isNurse || isDoctor || isPsychologist || isMaulana ? [] : navItemsForUser(user)),
    [isFinance, isReception, isGate, isInventoryManager, isCook, isDispenser, isNurse, isDoctor, isPsychologist, isMaulana, user]
  )

  useEffect(() => {
    if (!menuOpen) return undefined
    function onDoc(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const params = new URLSearchParams(location.search)
  const financeTab = params.get('tab') || 'fees'
  const onBilling = location.pathname.startsWith('/app/billing')
  const rawReceptionTab = params.get('tab') || 'register'
  const receptionTab = rawReceptionTab === 'requests' ? 'pending' : rawReceptionTab
  const onReception = location.pathname.startsWith('/app/reception')
  const gateTab = params.get('tab') || 'attendance'
  const onGate = location.pathname.startsWith('/app/visitors')
  const rawInventoryTab = params.get('tab') || 'use'
  const inventoryTab = INVENTORY_TABS.some((tab) => tab.match === rawInventoryTab)
    ? rawInventoryTab
    : 'use'
  const onInventory = location.pathname.startsWith('/app/inventory')
  const rawPharmacyTab = params.get('tab') || 'prescriptions'
  const pharmacyTab = DISPENSER_TABS.some((tab) => tab.match === rawPharmacyTab)
    ? rawPharmacyTab
    : 'prescriptions'
  const onPharmacy = location.pathname.startsWith('/app/pharmacy')
  const rawNurseTab = params.get('tab') || 'slips'
  const nurseTab = NURSE_TABS.some((tab) => tab.match === rawNurseTab) ? rawNurseTab : 'slips'
  const onNursing = location.pathname.startsWith('/app/nursing')
  const rawDoctorTab = params.get('tab') || 'vitals'
  const doctorTab = DOCTOR_TABS.some((tab) => tab.match === rawDoctorTab) ? rawDoctorTab : 'vitals'
  const onDoctors = location.pathname.startsWith('/app/doctors')

  return (
    <>
      <header className="role-nav">
        <div className="role-nav-brand">
          <img
            className="brand-logo role-nav-logo"
            src="/brand/jadeed-logo.png?v=6"
            alt="Jadeed Rifah"
          />
          <div className="role-nav-brand-text">
            <strong>Jadeed Rifah</strong>
            <span>{user?.role || 'Staff'}</span>
          </div>
        </div>

        <nav className="role-nav-tabs" aria-label="Staff sections">
          {isFinance
            ? FINANCE_TABS.map((tab) => {
                const active = onBilling && financeTab === tab.match
                return (
                  <NavLink
                    key={tab.match}
                    to={tab.to}
                    className={`role-nav-tab${active ? ' is-active' : ''}`}
                  >
                    {tab.label}
                  </NavLink>
                )
              })
            : isReception
              ? RECEPTION_TABS.map((tab) => {
                  const active = onReception && receptionTab === tab.match
                  return (
                    <NavLink
                      key={tab.match}
                      to={tab.to}
                      className={`role-nav-tab${active ? ' is-active' : ''}`}
                    >
                      {tab.label}
                    </NavLink>
                  )
                })
              : isGate
                ? GATE_TABS.map((tab) => {
                    const active = onGate && gateTab === tab.match
                    return (
                      <NavLink
                        key={tab.match}
                        to={tab.to}
                        className={`role-nav-tab${active ? ' is-active' : ''}`}
                      >
                        {tab.label}
                      </NavLink>
                    )
                  })
                : isInventoryManager
                  ? INVENTORY_TABS.map((tab) => {
                      const active = onInventory && inventoryTab === tab.match
                      return (
                        <NavLink
                          key={tab.match}
                          to={tab.to}
                          className={`role-nav-tab${active ? ' is-active' : ''}`}
                        >
                          {tab.label}
                        </NavLink>
                      )
                    })
                  : isDispenser
                    ? DISPENSER_TABS.map((tab) => {
                        const active = onPharmacy && pharmacyTab === tab.match
                        return (
                          <NavLink
                            key={tab.match}
                            to={tab.to}
                            className={`role-nav-tab${active ? ' is-active' : ''}`}
                          >
                            {tab.label}
                          </NavLink>
                        )
                      })
                    : isNurse
                      ? NURSE_TABS.map((tab) => {
                          const active = onNursing && nurseTab === tab.match
                          return (
                            <NavLink
                              key={tab.match}
                              to={tab.to}
                              className={`role-nav-tab${active ? ' is-active' : ''}`}
                            >
                              {tab.label}
                            </NavLink>
                          )
                        })
                      : isDoctor
                        ? DOCTOR_TABS.map((tab) => {
                            const active = onDoctors && doctorTab === tab.match
                            return (
                              <NavLink
                                key={tab.match}
                                to={tab.to}
                                className={`role-nav-tab${active ? ' is-active' : ''}`}
                              >
                                {tab.label}
                              </NavLink>
                            )
                          })
                        : isPsychologist || isMaulana
                          ? null
                          : items.map((item) => (
                              <NavLink
                                key={item.id}
                                to={item.to}
                                className={({ isActive }) => `role-nav-tab${isActive ? ' is-active' : ''}`}
                              >
                                {item.label}
                              </NavLink>
                            ))}
        </nav>

        <div className="role-nav-right">
          <NotificationBell />
          <div className="role-nav-category" title={user?.role || ''}>
            <span className="role-nav-category-label">Staff</span>
            <strong>{user?.role || '—'}</strong>
          </div>

          <div className="role-profile" ref={menuRef}>
            <button
              type="button"
              className="role-profile-btn"
              aria-label="Profile menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user?.photo_url ? (
                <img src={user.photo_url} alt="" className="role-profile-img" />
              ) : (
                <span className="role-profile-initials">{initials(user?.name)}</span>
              )}
            </button>

            {menuOpen ? (
              <div className="role-profile-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setProfileOpen(true)
                  }}
                >
                  <UserRound size={16} />
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setThemeOpen(true)
                  }}
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setMenuOpen(false)
                    onLogoutClick?.()
                  }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <ThemeSettingsModal open={themeOpen} onClose={() => setThemeOpen(false)} />
      <ProfileEditModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
