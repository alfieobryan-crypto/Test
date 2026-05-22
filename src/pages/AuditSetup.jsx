import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext.jsx'
import { ACTIONS } from '../context/reducer.js'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import { Field, Input, Select, Checkbox } from '../components/Field.jsx'

function newId() { return crypto.randomUUID() }

// ─── Site & Building forms ────────────────────────────────────────────────────

const DEGREE_DAY_REGIONS = [
  'South East', 'South West', 'Midlands', 'East Anglia', 'North West',
  'North East', 'Yorkshire', 'Scotland East', 'Scotland West', 'Northern Ireland',
]

function SiteForm({ initial = {}, onSave, onClose }) {
  const [v, setV] = useState({
    name: '', postcode: '', degreeDayRegion: DEGREE_DAY_REGIONS[0],
    includeInPortfolio: true, baselineGasKwh: '', baselineElecKwh: '',
    ...initial,
  })
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      ...v,
      baselineGasKwh:  Number(v.baselineGasKwh)  || 0,
      baselineElecKwh: Number(v.baselineElecKwh) || 0,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Site name" className="col-span-2">
          <Input value={v.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Northfield Campus" autoFocus />
        </Field>
        <Field label="Postcode">
          <Input value={v.postcode} onChange={e => set('postcode', e.target.value)} placeholder="e.g. B23 7DH" />
        </Field>
        <Field label="Degree day region">
          <Select value={v.degreeDayRegion} onChange={e => set('degreeDayRegion', e.target.value)}>
            {DEGREE_DAY_REGIONS.map(r => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Baseline gas (kWh/yr)">
          <Input type="number" min="0" value={v.baselineGasKwh} onChange={e => set('baselineGasKwh', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Baseline electricity (kWh/yr)">
          <Input type="number" min="0" value={v.baselineElecKwh} onChange={e => set('baselineElecKwh', e.target.value)} placeholder="0" />
        </Field>
      </div>
      <Checkbox label="Include in portfolio" checked={v.includeInPortfolio} onChange={e => set('includeInPortfolio', e.target.checked)} />
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Site</button>
      </div>
    </form>
  )
}

function BuildingForm({ initial = {}, onSave, onClose }) {
  const [v, setV] = useState({ name: '', floorAreaM2: '', ...initial })
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ ...v, floorAreaM2: Number(v.floorAreaM2) || 0 })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Building name">
        <Input value={v.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Main Block" autoFocus />
      </Field>
      <Field label="Floor area (m²)">
        <Input type="number" min="0" value={v.floorAreaM2} onChange={e => set('floorAreaM2', e.target.value)} placeholder="0" />
      </Field>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Building</button>
      </div>
    </form>
  )
}

// ─── Property form ────────────────────────────────────────────────────────────

const PROPERTY_TYPES     = ['Detached', 'Semi-detached', 'Terraced', 'Flat', 'Bungalow']
const CONSTRUCTION_ERAS  = ['Pre-1919', '1919-1944', '1945-1964', '1965-1980', '1981-1990', '1991-2002', 'Post-2002']
const EPC_RATINGS        = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const HEATING_FUELS      = ['Natural Gas', 'Oil', 'LPG', 'Electric', 'Solid Fuel']
const BOILER_TYPES       = ['Combi', 'System', 'Regular']
const HEAT_EMITTERS      = ['Radiators (LTHW)', 'Underfloor heating', 'Mixed']
const WALL_TYPES         = ['Cavity wall (uninsulated)', 'Cavity wall (insulated)', 'Solid wall (external ins.)', 'Solid wall (internal ins.)', 'Solid wall (uninsulated)', 'Timber frame']
const GLAZING_TYPES      = ['Single glazed', 'Double glazed', 'Triple glazed']

const PROPERTY_DEFAULTS = {
  address: '', postcode: '', propertyType: PROPERTY_TYPES[0],
  constructionEra: CONSTRUCTION_ERAS[0], floorAreaM2: '', numBedrooms: '',
  currentEpcRating: 'D', currentEpcScore: '', isOffGasGrid: false,
  currentHeatingFuel: 'Natural Gas', baselineGasKwh: '', baselineElecKwh: '',
  gasUnitRatePkWh: 6, elecUnitRatePkWh: 28,
  boilerType: 'Combi', boilerAgeYears: '', boilerEfficiencyPct: 80,
  currentHeatEmitters: HEAT_EMITTERS[0],
  wallType: WALL_TYPES[0], wallUValue: '', roofInsulationMm: '', roofUValue: '',
  floorUValue: '', glazingType: GLAZING_TYPES[1], glazingUValue: '',
}

function PropertyForm({ initial = {}, onSave, onClose }) {
  const [v, setV] = useState({ ...PROPERTY_DEFAULTS, ...initial })
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))
  const n = (val, fallback = 0) => Number(val) || fallback

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      ...v,
      floorAreaM2: n(v.floorAreaM2), numBedrooms: n(v.numBedrooms),
      currentEpcScore: n(v.currentEpcScore),
      baselineGasKwh: n(v.baselineGasKwh), baselineElecKwh: n(v.baselineElecKwh),
      gasUnitRatePkWh: n(v.gasUnitRatePkWh, 6), elecUnitRatePkWh: n(v.elecUnitRatePkWh, 28),
      boilerAgeYears: n(v.boilerAgeYears),
      boilerEfficiencyPct: n(v.boilerEfficiencyPct, 80) / 100,
      wallUValue: n(v.wallUValue), roofInsulationMm: n(v.roofInsulationMm),
      roofUValue: n(v.roofUValue), floorUValue: n(v.floorUValue), glazingUValue: n(v.glazingUValue),
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Address */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Address</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Address" className="col-span-2">
            <Input value={v.address} onChange={e => set('address', e.target.value)} required placeholder="123 Main Street" autoFocus />
          </Field>
          <Field label="Postcode">
            <Input value={v.postcode} onChange={e => set('postcode', e.target.value)} placeholder="B1 1AA" />
          </Field>
        </div>
      </section>

      {/* Property details */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Property Details</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Property type">
            <Select value={v.propertyType} onChange={e => set('propertyType', e.target.value)}>
              {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Construction era">
            <Select value={v.constructionEra} onChange={e => set('constructionEra', e.target.value)}>
              {CONSTRUCTION_ERAS.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Floor area (m²)">
            <Input type="number" min="0" value={v.floorAreaM2} onChange={e => set('floorAreaM2', e.target.value)} placeholder="85" />
          </Field>
          <Field label="Bedrooms">
            <Input type="number" min="0" value={v.numBedrooms} onChange={e => set('numBedrooms', e.target.value)} placeholder="3" />
          </Field>
          <Field label="EPC rating">
            <Select value={v.currentEpcRating} onChange={e => set('currentEpcRating', e.target.value)}>
              {EPC_RATINGS.map(r => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="EPC score">
            <Input type="number" min="0" max="100" value={v.currentEpcScore} onChange={e => set('currentEpcScore', e.target.value)} placeholder="55" />
          </Field>
        </div>
        <div className="mt-3">
          <Checkbox label="Off gas grid" checked={v.isOffGasGrid} onChange={e => set('isOffGasGrid', e.target.checked)} />
        </div>
      </section>

      {/* Energy use */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Energy Use (from bills)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heating fuel">
            <Select value={v.currentHeatingFuel} onChange={e => set('currentHeatingFuel', e.target.value)}>
              {HEATING_FUELS.map(f => <option key={f}>{f}</option>)}
            </Select>
          </Field>
          <div />
          <Field label="Baseline gas (kWh/yr)">
            <Input type="number" min="0" value={v.baselineGasKwh} onChange={e => set('baselineGasKwh', e.target.value)} placeholder="12000" />
          </Field>
          <Field label="Baseline electricity (kWh/yr)">
            <Input type="number" min="0" value={v.baselineElecKwh} onChange={e => set('baselineElecKwh', e.target.value)} placeholder="3500" />
          </Field>
          <Field label="Gas unit rate (p/kWh)">
            <Input type="number" min="0" step="0.1" value={v.gasUnitRatePkWh} onChange={e => set('gasUnitRatePkWh', e.target.value)} />
          </Field>
          <Field label="Electricity unit rate (p/kWh)">
            <Input type="number" min="0" step="0.1" value={v.elecUnitRatePkWh} onChange={e => set('elecUnitRatePkWh', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Heating system */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Heating System</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Boiler type">
            <Select value={v.boilerType} onChange={e => set('boilerType', e.target.value)}>
              {BOILER_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Boiler age (years)">
            <Input type="number" min="0" value={v.boilerAgeYears} onChange={e => set('boilerAgeYears', e.target.value)} placeholder="10" />
          </Field>
          <Field label="Boiler efficiency (%)" hint="Default 80%">
            <Input type="number" min="0" max="120" value={v.boilerEfficiencyPct} onChange={e => set('boilerEfficiencyPct', e.target.value)} />
          </Field>
          <Field label="Heat emitters">
            <Select value={v.currentHeatEmitters} onChange={e => set('currentHeatEmitters', e.target.value)}>
              {HEAT_EMITTERS.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
      </section>

      {/* Fabric */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Building Fabric</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Wall type" className="col-span-2">
            <Select value={v.wallType} onChange={e => set('wallType', e.target.value)}>
              {WALL_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Wall U-value (W/m²K)">
            <Input type="number" min="0" step="0.01" value={v.wallUValue} onChange={e => set('wallUValue', e.target.value)} placeholder="0.45" />
          </Field>
          <Field label="Roof insulation (mm)">
            <Input type="number" min="0" value={v.roofInsulationMm} onChange={e => set('roofInsulationMm', e.target.value)} placeholder="100" />
          </Field>
          <Field label="Roof U-value">
            <Input type="number" min="0" step="0.01" value={v.roofUValue} onChange={e => set('roofUValue', e.target.value)} placeholder="0.16" />
          </Field>
          <Field label="Floor U-value">
            <Input type="number" min="0" step="0.01" value={v.floorUValue} onChange={e => set('floorUValue', e.target.value)} placeholder="0.25" />
          </Field>
          <Field label="Glazing type" className="col-span-2">
            <Select value={v.glazingType} onChange={e => set('glazingType', e.target.value)}>
              {GLAZING_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Glazing U-value">
            <Input type="number" min="0" step="0.01" value={v.glazingUValue} onChange={e => set('glazingUValue', e.target.value)} placeholder="1.4" />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Property</button>
      </div>
    </form>
  )
}

// ─── Commercial: Sites/Buildings panel ────────────────────────────────────────

function BuildingItem({ building, auditId, dispatch }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50 group">
      <div className="text-sm text-gray-700">
        {building.name || 'Unnamed building'}
        {building.floorAreaM2 > 0 && (
          <span className="text-gray-400 ml-2">{building.floorAreaM2.toLocaleString()} m²</span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-0.5 rounded">Edit</button>
        <button
          onClick={() => {
            if (confirm(`Delete building "${building.name}"?`)) {
              dispatch({ type: ACTIONS.DELETE_BUILDING, payload: { auditId, buildingId: building.id } })
            }
          }}
          className="text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded"
        >
          Delete
        </button>
      </div>
      {editing && (
        <Modal title="Edit Building" onClose={() => setEditing(false)}>
          <BuildingForm
            initial={building}
            onSave={updated => dispatch({ type: ACTIONS.UPDATE_BUILDING, payload: { auditId, building: { ...building, ...updated } } })}
            onClose={() => setEditing(false)}
          />
        </Modal>
      )}
    </div>
  )
}

function SiteItem({ site, buildings, auditId, dispatch }) {
  const [expanded, setExpanded]       = useState(true)
  const [editingSite, setEditingSite] = useState(false)
  const [addingBldg, setAddingBldg]   = useState(false)
  const siteBldgs = buildings.filter(b => b.siteId === site.id)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">{site.name || 'Unnamed site'}</span>
            {!site.includeInPortfolio && (
              <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Excluded</span>
            )}
          </div>
          <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
            {site.postcode && <span>{site.postcode}</span>}
            <span>{siteBldgs.length} {siteBldgs.length === 1 ? 'building' : 'buildings'}</span>
            {site.baselineGasKwh > 0 && <span>{site.baselineGasKwh.toLocaleString()} kWh gas</span>}
          </div>
        </div>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditingSite(true)} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-white">Edit</button>
          <button
            onClick={() => {
              if (confirm(`Delete site "${site.name}" and all its buildings and assets?`)) {
                dispatch({ type: ACTIONS.DELETE_SITE, payload: { auditId, siteId: site.id } })
              }
            }}
            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-white"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3">
          {siteBldgs.length === 0 ? (
            <p className="text-sm text-gray-400 italic mb-2">No buildings yet</p>
          ) : (
            <div className="mb-2">
              {siteBldgs.map(b => (
                <BuildingItem key={b.id} building={b} auditId={auditId} dispatch={dispatch} />
              ))}
            </div>
          )}
          <button
            onClick={() => setAddingBldg(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <span>+</span> Add building
          </button>
        </div>
      )}

      {editingSite && (
        <Modal title="Edit Site" onClose={() => setEditingSite(false)}>
          <SiteForm
            initial={site}
            onSave={updated => dispatch({ type: ACTIONS.UPDATE_SITE, payload: { auditId, site: { ...site, ...updated } } })}
            onClose={() => setEditingSite(false)}
          />
        </Modal>
      )}
      {addingBldg && (
        <Modal title="Add Building" onClose={() => setAddingBldg(false)}>
          <BuildingForm
            onSave={bldg => dispatch({ type: ACTIONS.ADD_BUILDING, payload: { auditId, building: { id: newId(), siteId: site.id, ...bldg } } })}
            onClose={() => setAddingBldg(false)}
          />
        </Modal>
      )}
    </div>
  )
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ audit, auditId, dispatch }) {
  const s = audit.settings
  const set = (k, val) => dispatch({ type: ACTIONS.UPDATE_SETTINGS, payload: { auditId, settings: { [k]: Number(val) || 0 } } })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Audit Settings</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Gas unit rate (p/kWh)">
          <Input type="number" min="0" step="0.1" defaultValue={s.gasUnitRatePkWh} onBlur={e => set('gasUnitRatePkWh', e.target.value)} />
        </Field>
        <Field label="Electricity unit rate (p/kWh)">
          <Input type="number" min="0" step="0.1" defaultValue={s.elecUnitRatePkWh} onBlur={e => set('elecUnitRatePkWh', e.target.value)} />
        </Field>
        <Field label="Gas carbon factor (tCO₂e/kWh)" hint="Default: 0.00018387 — DESNZ 2023">
          <Input type="number" min="0" step="0.00000001" defaultValue={s.gasCarbonFactor} onBlur={e => set('gasCarbonFactor', e.target.value)} />
        </Field>
        <Field label="Electricity carbon factor (tCO₂e/kWh)" hint="Default: 0.00019121 — Grid Scope 2">
          <Input type="number" min="0" step="0.00000001" defaultValue={s.elecCarbonFactor} onBlur={e => set('elecCarbonFactor', e.target.value)} />
        </Field>
        {audit.mode === 'commercial' && (
          <>
            <Field label="Salix carbon price (£/LTtCO₂e)" hint="Default: £95">
              <Input type="number" min="0" defaultValue={s.salixCarbonPricePer_LTtCO2} onBlur={e => set('salixCarbonPricePer_LTtCO2', e.target.value)} />
            </Field>
            <Field label="Like-for-like replacement cost (£)" hint="Used for Salix contribution floor">
              <Input type="number" min="0" defaultValue={s.likeForLikeReplacementCost} onBlur={e => set('likeForLikeReplacementCost', e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditSetup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useAudit()
  const [addingSite, setAddingSite]   = useState(false)
  const [addingProp, setAddingProp]   = useState(false)
  const [editingPropId, setEditingPropId] = useState(null)

  const audit = state.audits[id]
  if (!audit) return (
    <Layout>
      <div className="text-center py-20 text-gray-500">Audit not found. <a href="/" className="text-blue-600 underline">Go to dashboard</a></div>
    </Layout>
  )

  const editingProp = editingPropId ? audit.properties.find(p => p.id === editingPropId) : null

  return (
    <Layout>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* Client info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Client Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client name">
              <Input
                defaultValue={audit.client?.name}
                onBlur={e => dispatch({ type: ACTIONS.UPDATE_CLIENT, payload: { auditId: id, client: { name: e.target.value } } })}
                placeholder="Organisation name"
              />
            </Field>
            <Field label="Contact email">
              <Input
                type="email"
                defaultValue={audit.client?.email}
                onBlur={e => dispatch({ type: ACTIONS.UPDATE_CLIENT, payload: { auditId: id, client: { email: e.target.value } } })}
                placeholder="contact@example.com"
              />
            </Field>
          </div>
        </div>

        {/* Settings */}
        <SettingsPanel audit={audit} auditId={id} dispatch={dispatch} />

        {/* Commercial: Sites */}
        {audit.mode === 'commercial' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Sites</h2>
              <button
                onClick={() => setAddingSite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span>+</span> Add site
              </button>
            </div>
            {audit.sites.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No sites added yet. Add a site to begin.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {audit.sites.map(site => (
                  <SiteItem
                    key={site.id}
                    site={site}
                    buildings={audit.buildings.filter(b => b.siteId === site.id)}
                    auditId={id}
                    dispatch={dispatch}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Residential: Properties */}
        {audit.mode === 'residential' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Properties</h2>
              <button
                onClick={() => setAddingProp(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100"
              >
                <span>+</span> Add property
              </button>
            </div>
            {audit.properties.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No properties added yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {audit.properties.map(prop => (
                  <div key={prop.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 hover:border-gray-200 group">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{prop.address || 'Unnamed property'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {prop.propertyType} · {prop.constructionEra} · EPC {prop.currentEpcRating}
                        {prop.floorAreaM2 > 0 && ` · ${prop.floorAreaM2} m²`}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingPropId(prop.id)} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded">Edit</button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete property "${prop.address}"?`)) {
                            dispatch({ type: ACTIONS.DELETE_PROPERTY, payload: { auditId: id, propertyId: prop.id } })
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next step */}
        <div className="flex justify-end pb-8">
          <button
            onClick={() => navigate(`/audit/${id}/${audit.mode === 'commercial' ? 'assets' : 'crm'}`)}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Next: {audit.mode === 'commercial' ? 'Asset Register →' : 'CRM Builder →'}
          </button>
        </div>
      </div>

      {addingSite && (
        <Modal title="Add Site" onClose={() => setAddingSite(false)}>
          <SiteForm
            onSave={site => dispatch({ type: ACTIONS.ADD_SITE, payload: { auditId: id, site: { id: newId(), clientId: audit.client?.name, ...site } } })}
            onClose={() => setAddingSite(false)}
          />
        </Modal>
      )}
      {addingProp && (
        <Modal title="Add Property" wide onClose={() => setAddingProp(false)}>
          <PropertyForm
            onSave={prop => dispatch({ type: ACTIONS.ADD_PROPERTY, payload: { auditId: id, property: { id: newId(), auditId: id, ...prop } } })}
            onClose={() => setAddingProp(false)}
          />
        </Modal>
      )}
      {editingProp && (
        <Modal title="Edit Property" wide onClose={() => setEditingPropId(null)}>
          <PropertyForm
            initial={{ ...editingProp, boilerEfficiencyPct: editingProp.boilerEfficiencyPct * 100 }}
            onSave={updated => dispatch({ type: ACTIONS.UPDATE_PROPERTY, payload: { auditId: id, property: { ...editingProp, ...updated } } })}
            onClose={() => setEditingPropId(null)}
          />
        </Modal>
      )}
    </Layout>
  )
}
