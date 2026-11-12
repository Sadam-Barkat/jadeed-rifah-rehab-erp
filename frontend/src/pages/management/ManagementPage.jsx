import { useState } from 'react'
import { Link } from 'react-router-dom'
import UsersPage from '../users/UsersPage'
import PatientsPage from '../patients/PatientsPage'
import '../pages.css'

const TABS = [
  { id: 'staff', label: 'Staff' },
  { id: 'patients', label: 'Patients' },
]

export default function ManagementPage() {
  const [tab, setTab] = useState('staff')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Management</h2>
          <p className="panel-copy">Manage staff accounts and patients in one place.</p>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-ghost ui-btn-md" to="/app/owner-dashboard">
            Dashboard
          </Link>
          <Link className="ui-btn ui-btn-secondary ui-btn-md" to="/app/settings">
            Settings
          </Link>
        </div>
      </div>

      <div className="mgmt-tabs" role="tablist" aria-label="Management">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`mgmt-tab ${tab === item.id ? 'is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mgmt-panel" role="tabpanel">
        {tab === 'staff' ? <UsersPage embedded /> : <PatientsPage embedded />}
      </div>
    </div>
  )
}
