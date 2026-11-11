import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { MODULES } from '../data/modules'
import Button from '../components/ui/Button'
import './pages.css'

export default function ModulePage() {
  const { pathname } = useLocation()
  const module = useMemo(
    () => MODULES.find((m) => m.path === pathname) || { name: 'Module', group: 'General' },
    [pathname],
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{module.group}</p>
          <h2>{module.name}</h2>
        </div>
        <div className="page-actions">
          <Button
            variant="primary"
            onClick={() => toast.success(`${module.name}: sample action saved`)}
          >
            Add new
          </Button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Frontend preview</h3>
        </div>
        <p className="panel-copy">
          This screen is ready in the UI shell. Backend wiring will be connected module by module.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sample item 01</td>
                <td>
                  <span className="badge">Active</span>
                </td>
                <td>Today</td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toast.message('View details coming with API')}
                  >
                    View
                  </Button>
                </td>
              </tr>
              <tr>
                <td>Sample item 02</td>
                <td>
                  <span className="badge badge-warn">Pending</span>
                </td>
                <td>Yesterday</td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toast.message('Edit coming with API')}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
