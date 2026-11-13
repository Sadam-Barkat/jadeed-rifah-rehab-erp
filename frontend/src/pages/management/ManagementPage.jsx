import { Link, useSearchParams } from 'react-router-dom'
import UsersPage from '../users/UsersPage'
import PatientsPage from '../patients/PatientsPage'
import '../pages.css'

const TABS = [
  { id: 'staff', label: 'Staff' },
  { id: 'patients', label: 'Patients' },
]

export default function ManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'patients' ? 'patients' : 'staff'

  function setTab(next) {
    setSearchParams(next === 'patients' ? { tab: 'patients' } : {}, { replace: true })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Management</h2>
        </div>
        <div className="page-actions">
          <Link className="ui-btn ui-btn-back ui-btn-md" to="/app/owner-dashboard">
            Back
          </Link>
        </div>
      </div>

      <div className="mgmt-tabs mgmt-tabs-sticky" role="tablist" aria-label="Management">
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
