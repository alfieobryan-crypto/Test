import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext.jsx'
import { ACTIONS } from '../context/reducer.js'
import { OPERATING_PATTERNS } from '../engine/constants.js'
import { calculateAssetKwh } from '../engine/calculations.js'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import { Field, Input, Select } from '../components/Field.jsx'

function newId() { return crypto.randomUUID() }

const SEU_OPTIONS       = ['Space Heating', 'Hot Water Services', 'Space Cooling', 'Lighting', 'Ventilation', 'Other']
const ENERGY_SOURCES    = ['Natural Gas', 'Electricity', 'Oil', 'LPG']
const PATTERN_OPTIONS   = [...Object.keys(OPERATING_PATTERNS), 'Custom']

const ASSET_DEFAULTS = {
  assetRef: '', description: '', seu: SEU_OPTIONS[0], energySource: ENERGY_SOURCES[0],
  meterRef: '', unitRatePkWh: 6, ratedKw: '', efficiencyPct: 80,
  qty: 1, operatingPattern: 'Office Hours 5 day', operatingHoursPerYear: 3120,
  loadFactor: 100,
}

function AssetForm({ initial = {}, onSave, onClose, buildingId, siteId }) {
  const [v, setV] = useState({ ...ASSET_DEFAULTS, ...initial,
    efficiencyPct: initial.efficiencyPct != null ? initial.efficiencyPct * 100 : 80,
    loadFactor: initial.loadFactor != null ? initial.loadFactor * 100 : 100,
  })
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))

  function handlePatternChange(pattern) {
    set('operatingPattern', pattern)
    if (pattern !== 'Custom') {
      set('operatingHoursPerYear', OPERATING_PATTERNS[pattern])
    }
  }

  const preview = {
    ratedKw: Number(v.ratedKw) || 0,
    qty: Number(v.qty) || 1,
    operatingHoursPerYear: Number(v.operatingHoursPerYear) || 0,
    loadFactor: (Number(v.loadFactor) || 0) / 100,
    efficiencyPct: (Number(v.efficiencyPct) || 80) / 100,
  }
  const previewKwh = preview.ratedKw > 0 ? calculateAssetKwh(preview) : null

  function handleSubmit(e) {
    e.preventDefault()
    const eff = (Number(v.efficiencyPct) || 80) / 100
    const lf  = (Number(v.loadFactor) || 100) / 100
    onSave({
      ...v,
      buildingId, siteId,
      ratedKw:              Number(v.ratedKw) || 0,
      qty:                  Number(v.qty) || 1,
      unitRatePkWh:         Number(v.unitRatePkWh) || 0,
      efficiencyPct:        eff,
      loadFactor:           lf,
      operatingHoursPerYear: Number(v.operatingHoursPerYear) || 0,
      annualKwhConsumed:    calculateAssetKwh({ ...preview, efficiencyPct: eff, loadFactor: lf }),
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Asset ref">
          <Input value={v.assetRef} onChange={e => set('assetRef', e.target.value)} placeholder="#1" />
        </Field>
        <Field label="SEU (Significant Energy Use)">
          <Select value={v.seu} onChange={e => set('seu', e.target.value)}>
            {SEU_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Description" className="col-span-2">
          <Input value={v.description} onChange={e => set('description', e.target.value)} required placeholder="e.g. Boiler_Hoval SR Plus 400" autoFocus />
        </Field>
        <Field label="Energy source">
          <Select value={v.energySource} onChange={e => set('energySource', e.target.value)}>
            {ENERGY_SOURCES.map(o => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Meter ref">
          <Input value={v.meterRef} onChange={e => set('meterRef', e.target.value)} placeholder="M1" />
        </Field>
        <Field label="Rated output (kW)">
          <Input type="number" min="0" step="0.1" value={v.ratedKw} onChange={e => set('ratedKw', e.target.value)} required placeholder="100" />
        </Field>
        <Field label="Efficiency (%)" hint="e.g. 80 for an 80% efficient boiler">
          <Input type="number" min="1" max="500" step="0.1" value={v.efficiencyPct} onChange={e => set('efficiencyPct', e.target.value)} />
        </Field>
        <Field label="Quantity">
          <Input type="number" min="1" value={v.qty} onChange={e => set('qty', e.target.value)} />
        </Field>
        <Field label="Unit rate (p/kWh)">
          <Input type="number" min="0" step="0.1" value={v.unitRatePkWh} onChange={e => set('unitRatePkWh', e.target.value)} />
        </Field>
        <Field label="Operating pattern">
          <Select value={v.operatingPattern} onChange={e => handlePatternChange(e.target.value)}>
            {PATTERN_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </Select>
        </Field>
        <Field label="Operating hours/yr">
          <Input
            type="number" min="0" max="8760"
            value={v.operatingHoursPerYear}
            onChange={e => set('operatingHoursPerYear', e.target.value)}
            disabled={v.operatingPattern !== 'Custom'}
          />
        </Field>
        <Field label="Load factor (%)" hint="Typical demand vs rated output. e.g. 20 = 20%">
          <Input type="number" min="1" max="100" step="1" value={v.loadFactor} onChange={e => set('loadFactor', e.target.value)} />
        </Field>
      </div>

      {previewKwh != null && (
        <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
          <span className="text-gray-600">Annual fuel consumption: </span>
          <span className="font-semibold text-blue-700">{Math.round(previewKwh).toLocaleString()} kWh/yr</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Asset</button>
      </div>
    </form>
  )
}

function AssetRow({ asset, auditId, dispatch }) {
  const [editing, setEditing] = useState(false)

  return (
    <>
      <tr className="group hover:bg-blue-50 transition-colors">
        <td className="px-3 py-2 text-xs text-gray-500">{asset.assetRef}</td>
        <td className="px-3 py-2 text-sm text-gray-900 max-w-48 truncate" title={asset.description}>{asset.description}</td>
        <td className="px-3 py-2 text-xs text-gray-600">{asset.seu}</td>
        <td className="px-3 py-2 text-xs text-gray-600">{asset.energySource}</td>
        <td className="px-3 py-2 text-sm text-right text-gray-700">{asset.ratedKw.toLocaleString()}</td>
        <td className="px-3 py-2 text-sm text-right text-gray-700">{Math.round(asset.efficiencyPct * 100)}%</td>
        <td className="px-3 py-2 text-sm text-right text-gray-700">{asset.qty}</td>
        <td className="px-3 py-2 text-xs text-gray-600">{asset.operatingPattern}</td>
        <td className="px-3 py-2 text-sm text-right text-gray-700">{Math.round(asset.loadFactor * 100)}%</td>
        <td className="px-3 py-2 text-sm text-right font-medium text-blue-700">
          {Math.round(asset.annualKwhConsumed).toLocaleString()}
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded">Edit</button>
            <button
              onClick={() => {
                if (confirm(`Delete asset "${asset.description}"?`)) {
                  dispatch({ type: ACTIONS.DELETE_ASSET, payload: { auditId, assetId: asset.id } })
                }
              }}
              className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded"
            >Del</button>
          </div>
        </td>
      </tr>
      {editing && (
        <Modal title="Edit Asset" wide onClose={() => setEditing(false)}>
          <AssetForm
            initial={{ ...asset, efficiencyPct: asset.efficiencyPct * 100, loadFactor: asset.loadFactor * 100 }}
            buildingId={asset.buildingId}
            siteId={asset.siteId}
            onSave={updated => dispatch({ type: ACTIONS.UPDATE_ASSET, payload: { auditId, asset: { ...asset, ...updated } } })}
            onClose={() => setEditing(false)}
          />
        </Modal>
      )}
    </>
  )
}

function BuildingSection({ building, assets, auditId, dispatch }) {
  const [addingAsset, setAddingAsset] = useState(false)
  const bldgAssets = assets.filter(a => a.buildingId === building.id)
  const totalKwh   = bldgAssets.reduce((s, a) => s + a.annualKwhConsumed, 0)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-gray-800">{building.name || 'Unnamed building'}</span>
          {building.floorAreaM2 > 0 && (
            <span className="text-sm text-gray-500 ml-2">{building.floorAreaM2.toLocaleString()} m²</span>
          )}
          {totalKwh > 0 && (
            <span className="ml-3 text-sm text-blue-600 font-medium">{Math.round(totalKwh).toLocaleString()} kWh/yr total</span>
          )}
        </div>
        <button
          onClick={() => setAddingAsset(true)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <span>+</span> Add asset
        </button>
      </div>

      {bldgAssets.length === 0 ? (
        <p className="text-sm text-gray-400 italic px-2">No assets added for this building.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ref</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SEU</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Source</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">kW</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Eff.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Pattern</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Load</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">kWh/yr</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bldgAssets.map(asset => (
                <AssetRow key={asset.id} asset={asset} auditId={auditId} dispatch={dispatch} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addingAsset && (
        <Modal title="Add Asset" wide onClose={() => setAddingAsset(false)}>
          <AssetForm
            buildingId={building.id}
            siteId={building.siteId}
            onSave={asset => dispatch({ type: ACTIONS.ADD_ASSET, payload: { auditId, asset: { id: newId(), ...asset } } })}
            onClose={() => setAddingAsset(false)}
          />
        </Modal>
      )}
    </div>
  )
}

export default function AssetRegister() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useAudit()
  const audit = state.audits[id]

  if (!audit) return <Layout><div className="text-center py-20 text-gray-500">Audit not found.</div></Layout>
  if (audit.mode !== 'commercial') {
    navigate(`/audit/${id}/setup`)
    return null
  }

  const totalAssets = audit.assets.length
  const totalKwh    = audit.assets.reduce((s, a) => s + a.annualKwhConsumed, 0)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Asset Register</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalAssets} {totalAssets === 1 ? 'asset' : 'assets'}
              {totalKwh > 0 && ` · ${Math.round(totalKwh).toLocaleString()} kWh/yr portfolio total`}
            </p>
          </div>
        </div>

        {audit.sites.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">No sites set up yet.</p>
            <button onClick={() => navigate(`/audit/${id}/setup`)} className="text-blue-600 hover:underline text-sm">
              Go to Setup to add sites and buildings
            </button>
          </div>
        ) : (
          audit.sites.map(site => {
            const siteBuildings = audit.buildings.filter(b => b.siteId === site.id)
            return (
              <div key={site.id} className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{site.name}</h2>
                  {site.postcode && <span className="text-sm text-gray-500">{site.postcode}</span>}
                  {!site.includeInPortfolio && (
                    <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">Excluded from portfolio</span>
                  )}
                </div>
                {siteBuildings.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No buildings for this site. <button onClick={() => navigate(`/audit/${id}/setup`)} className="text-blue-600 hover:underline">Add buildings in Setup.</button></p>
                ) : (
                  siteBuildings.map(building => (
                    <BuildingSection
                      key={building.id}
                      building={building}
                      assets={audit.assets}
                      auditId={id}
                      dispatch={dispatch}
                    />
                  ))
                )}
              </div>
            )
          })
        )}

        <div className="flex justify-between pt-4 pb-8">
          <button
            onClick={() => navigate(`/audit/${id}/setup`)}
            className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            ← Back to Setup
          </button>
          <button
            onClick={() => navigate(`/audit/${id}/crm`)}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Next: CRM Builder →
          </button>
        </div>
      </div>
    </Layout>
  )
}
