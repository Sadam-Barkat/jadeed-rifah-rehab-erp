import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { formatPkr } from '../../lib/format'
import Button from '../../components/ui/Button'
import { SkeletonCards } from '../../components/ui/Skeleton'
import '../pages.css'

const emptyAsset = {
  name: '',
  category: 'equipment',
  location: '',
  purchase_date: '',
  purchase_cost: '',
  condition: 'good',
}

const emptyMaint = {
  asset_id: '',
  issue: '',
  cost: '',
}

export default function AssetsPage() {
  const [loading, setLoading] = useState(true)
  const [savingAsset, setSavingAsset] = useState(false)
  const [savingMaint, setSavingMaint] = useState(false)
  const [completingId, setCompletingId] = useState(null)
  const [assets, setAssets] = useState([])
  const [maints, setMaints] = useState([])
  const [assetForm, setAssetForm] = useState(emptyAsset)
  const [maintForm, setMaintForm] = useState(emptyMaint)

  async function load() {
    setLoading(true)
    try {
      const [aRes, mRes] = await Promise.all([
        api('/assets?per_page=50'),
        api('/asset-maintenances?per_page=20'),
      ])
      setAssets(aRes.data || [])
      setMaints(mRes.data || [])
    } catch (err) {
      toast.error(err.message || 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAsset(e) {
    e.preventDefault()
    setSavingAsset(true)
    try {
      const data = await api('/assets', {
        method: 'POST',
        body: {
          name: assetForm.name,
          category: assetForm.category,
          location: assetForm.location || null,
          purchase_date: assetForm.purchase_date || null,
          purchase_cost: assetForm.purchase_cost ? Number(assetForm.purchase_cost) : 0,
          condition: assetForm.condition,
        },
      })
      toast.success(`${data.data.asset_code} registered`)
      setAssetForm(emptyAsset)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to add asset')
    } finally {
      setSavingAsset(false)
    }
  }

  async function handleMaint(e) {
    e.preventDefault()
    setSavingMaint(true)
    try {
      const data = await api('/asset-maintenances', {
        method: 'POST',
        body: {
          asset_id: Number(maintForm.asset_id),
          issue: maintForm.issue,
          cost: maintForm.cost ? Number(maintForm.cost) : 0,
          status: 'open',
        },
      })
      toast.success(`${data.data.maintenance_code} logged`)
      setMaintForm(emptyMaint)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to log maintenance')
    } finally {
      setSavingMaint(false)
    }
  }

  async function completeMaint(m) {
    setCompletingId(m.id)
    try {
      const data = await api(`/asset-maintenances/${m.id}/complete`, {
        method: 'POST',
        body: { work_done: m.work_done || 'Completed' },
      })
      toast.success(`${data.data.maintenance_code} completed`)
      load()
    } catch (err) {
      toast.error(err.message || 'Complete failed')
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Assets & Maintenance</h2>
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <form className="panel form-grid" onSubmit={handleAsset}>
            <div className="panel-head full"><h3>Register asset</h3></div>
            <div className="ui-field">
              <label htmlFor="name">Name</label>
              <input id="name" className="ui-input" required value={assetForm.name} onChange={(e) => setAssetForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="category">Category</label>
              <select id="category" className="ui-select" value={assetForm.category} onChange={(e) => setAssetForm((p) => ({ ...p, category: e.target.value }))}>
                <option value="equipment">Equipment</option>
                <option value="furniture">Furniture</option>
                <option value="electronics">Electronics</option>
                <option value="vehicle">Vehicle</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="location">Location</label>
              <input id="location" className="ui-input" value={assetForm.location} onChange={(e) => setAssetForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="purchase_cost">Purchase cost (PKR)</label>
              <input id="purchase_cost" className="ui-input" type="number" min="0" value={assetForm.purchase_cost} onChange={(e) => setAssetForm((p) => ({ ...p, purchase_cost: e.target.value }))} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingAsset}>{savingAsset ? 'Saving...' : 'Add asset'}</Button>
            </div>
          </form>

          <form className="panel form-grid" onSubmit={handleMaint}>
            <div className="panel-head full"><h3>Log maintenance</h3></div>
            <div className="ui-field">
              <label htmlFor="asset_id">Asset</label>
              <select id="asset_id" className="ui-select" required value={maintForm.asset_id} onChange={(e) => setMaintForm((p) => ({ ...p, asset_id: e.target.value }))}>
                <option value="">Select asset</option>
                {assets.filter((a) => a.status !== 'retired').map((a) => (
                  <option key={a.id} value={a.id}>{a.asset_code} · {a.name}</option>
                ))}
              </select>
            </div>
            <div className="ui-field">
              <label htmlFor="issue">Issue</label>
              <input id="issue" className="ui-input" required value={maintForm.issue} onChange={(e) => setMaintForm((p) => ({ ...p, issue: e.target.value }))} />
            </div>
            <div className="ui-field">
              <label htmlFor="cost">Cost (PKR)</label>
              <input id="cost" className="ui-input" type="number" min="0" value={maintForm.cost} onChange={(e) => setMaintForm((p) => ({ ...p, cost: e.target.value }))} />
            </div>
            <div className="form-actions full">
              <Button type="submit" disabled={savingMaint || !assets.length}>{savingMaint ? 'Saving...' : 'Log maintenance'}</Button>
            </div>
          </form>

          <section className="panel">
            <div className="panel-head"><h3>Assets</h3></div>
            {assets.length === 0 ? (
              <p className="panel-copy">No assets yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Location</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id}>
                        <td>{a.asset_code}</td>
                        <td>{a.name}</td>
                        <td>{a.category}</td>
                        <td>{a.location || '—'}</td>
                        <td>{formatPkr(a.current_value ?? a.purchase_cost)}</td>
                        <td><span className="badge">{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Maintenance</h3></div>
            {maints.length === 0 ? (
              <p className="panel-copy">No maintenance records yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Asset</th>
                      <th>Issue</th>
                      <th>Cost</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maints.map((m) => (
                      <tr key={m.id}>
                        <td>{m.maintenance_code}</td>
                        <td>{m.asset?.asset_code} · {m.asset?.name}</td>
                        <td>{m.issue}</td>
                        <td>{formatPkr(m.cost)}</td>
                        <td><span className="badge">{m.status}</span></td>
                        <td>
                          {m.status === 'open' ? (
                            <Button type="button" variant="secondary" disabled={completingId === m.id} onClick={() => completeMaint(m)}>
                              Complete
                            </Button>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
