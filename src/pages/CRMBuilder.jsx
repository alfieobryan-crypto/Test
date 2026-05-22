import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext.jsx'
import { ACTIONS } from '../context/reducer.js'
import {
  COMMERCIAL_CRM_LIBRARY, RESIDENTIAL_CRM_LIBRARY,
  COMMERCIAL_SCOP, RESIDENTIAL_SCOP,
} from '../engine/constants.js'
import {
  calculateCRMSavings, calculateNetLtCo2, calculateAnnualCostSaving, calculateCCT,
  calculateResidentialCRMSavings, calculateResidentialLtCo2, checkGrantEligibility,
  calculateSolarYield,
} from '../engine/calculations.js'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import { Field, Input, Select } from '../components/Field.jsx'

function uid() { return crypto.randomUUID() }

// ─── Display helpers ──────────────────────────────────────────────────────────

const CAT_COLOURS = {
  Energy_Efficiency: 'bg-blue-100 text-blue-700',
  Green_Thermal:     'bg-emerald-100 text-emerald-700',
  Green_Power:       'bg-yellow-100 text-yellow-700',
  Behaviour_Change:  'bg-purple-100 text-purple-700',
  Fabric:            'bg-orange-100 text-orange-700',
  'Green Thermal':   'bg-emerald-100 text-emerald-700',
  'Green Power':     'bg-yellow-100 text-yellow-700',
  Controls:          'bg-teal-100 text-teal-700',
  Electrical:        'bg-indigo-100 text-indigo-700',
}
const catColour = cat => CAT_COLOURS[cat] || 'bg-gray-100 text-gray-600'
const fmtPounds = p => `£${Math.round(p / 100).toLocaleString('en-GB')}`
const fmtGbp    = n => `£${Math.round(n).toLocaleString('en-GB')}`
const fmtKwh    = n => `${Math.round(n).toLocaleString('en-GB')} kWh`
const fmtTco2   = n => `${n.toFixed(1)} tCO₂e`
const fmtCct    = n => n == null ? '—' : `£${n.toFixed(0)}/t`

// ─── Commercial SCOP options ──────────────────────────────────────────────────

const COMM_SCOP_OPTS = [
  { label: 'LTHW 55 °C – radiators (2.4)', value: COMMERCIAL_SCOP.lthw_55 },
  { label: 'LTHW 45 °C – upgraded rads (2.7)', value: COMMERCIAL_SCOP.lthw_45 },
  { label: 'LTHW 35 °C – underfloor (3.2)', value: COMMERCIAL_SCOP.lthw_35 },
  { label: 'DHW (2.3)', value: COMMERCIAL_SCOP.dhw },
  { label: 'GSHP (3.2)', value: COMMERCIAL_SCOP.gshp },
]
const RES_SCOP_OPTS = [
  { label: 'ASHP radiators LTHW 55 °C (2.5)', value: RESIDENTIAL_SCOP.ashp_radiators_lthw55 },
  { label: 'ASHP radiators LTHW 45 °C (2.8)', value: RESIDENTIAL_SCOP.ashp_radiators_lthw45 },
  { label: 'ASHP underfloor LTHW 35 °C (3.2)', value: RESIDENTIAL_SCOP.ashp_underfloor_lthw35 },
  { label: 'ASHP DHW (2.3)', value: RESIDENTIAL_SCOP.ashp_dhw },
  { label: 'GSHP radiators (3.2)', value: RESIDENTIAL_SCOP.gshp_radiators },
  { label: 'GSHP underfloor (3.8)', value: RESIDENTIAL_SCOP.gshp_underfloor },
]

// ─── Group CRM library by category for <optgroup> ────────────────────────────

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key]; (acc[k] = acc[k] || []).push(item); return acc
  }, {})
}

// ─── Commercial CRM form ──────────────────────────────────────────────────────

const COMM_DEFAULTS = {
  crmType: '', crmCategory: '', crmSubCategory: '', utility: 'gas',
  description: '', implementationYear: new Date().getFullYear(),
  reductionPctAuto: null, reductionPctManualPct: '',
  isFuelSwitch: false, existingEfficiencyPct: 80, scopPreset: '',
  proposedSCOP: '', isSolarPV: false, solarKwp: '',
  capexCost: '', persistenceFactor: '',
}

function CommercialCRMForm({ initial, asset, audit, onSave, onClose }) {
  const libEntry = type => COMMERCIAL_CRM_LIBRARY.find(e => e.type === type)
  const initVals = initial ? {
    ...COMM_DEFAULTS,
    ...initial,
    reductionPctManualPct: initial.reductionPctManual != null ? String(initial.reductionPctManual * 100) : '',
    existingEfficiencyPct: initial.existingEfficiency != null ? initial.existingEfficiency * 100 : 80,
    proposedSCOP: initial.proposedSCOP != null ? String(initial.proposedSCOP) : '',
    capexCost: initial.capexCost != null ? String(initial.capexCost) : '',
    persistenceFactor: initial.persistenceFactor != null ? String(initial.persistenceFactor) : '',
  } : { ...COMM_DEFAULTS }

  const [v, setV] = useState(initVals)
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))

  function pickLibEntry(type) {
    const e = libEntry(type)
    if (!e) return
    setV(p => ({
      ...p,
      crmType: e.type, crmCategory: e.category, crmSubCategory: e.subCategory,
      utility: e.utility || 'gas',
      description: e.type,
      reductionPctAuto: e.defaultReductionPct ?? null,
      reductionPctManualPct: '',
      isFuelSwitch: e.isFuelSwitch || false,
      isSolarPV: e.isSolarPV || false,
      persistenceFactor: String(e.persistence),
      proposedSCOP: e.isFuelSwitch ? String(COMMERCIAL_SCOP.lthw_55) : '',
    }))
  }

  // Live preview
  const preview = useMemo(() => {
    if (!v.crmType || !asset) return null
    const reductionPctManual = v.reductionPctManualPct !== '' ? Number(v.reductionPctManualPct) / 100 : null
    const scop = v.proposedSCOP !== '' ? Number(v.proposedSCOP) : null
    const tempCrm = {
      reductionPctAuto: v.reductionPctAuto,
      reductionPctManual,
      isFuelSwitch: v.isFuelSwitch,
      existingEfficiency: Number(v.existingEfficiencyPct) / 100,
      proposedSCOP: scop,
      utility: v.utility,
      persistenceFactor: Number(v.persistenceFactor) || 1,
      isSolarPV: v.isSolarPV,
      solarKwp: v.isSolarPV ? Number(v.solarKwp) : null,
    }
    try {
      const savings  = calculateCRMSavings(tempCrm, asset)
      const ltCo2    = calculateNetLtCo2(tempCrm, asset, audit.settings)
      const costSave = calculateAnnualCostSaving(tempCrm, asset, audit.settings)
      const cct      = calculateCCT(Number(v.capexCost) || 0, ltCo2)
      return { savings, ltCo2, costSave, cct }
    } catch { return null }
  }, [v, asset, audit.settings])

  function handleSubmit(e) {
    e.preventDefault()
    const reductionPctManual = v.reductionPctManualPct !== '' ? Number(v.reductionPctManualPct) / 100 : null
    onSave({
      crmType: v.crmType, crmCategory: v.crmCategory, crmSubCategory: v.crmSubCategory,
      utility: v.utility, description: v.description,
      implementationYear: Number(v.implementationYear),
      reductionPctAuto: v.reductionPctAuto, reductionPctManual,
      isFuelSwitch: v.isFuelSwitch,
      existingEfficiency: Number(v.existingEfficiencyPct) / 100,
      proposedSCOP: v.proposedSCOP !== '' ? Number(v.proposedSCOP) : null,
      isSolarPV: v.isSolarPV,
      solarKwp: v.isSolarPV ? Number(v.solarKwp) || null : null,
      capexCost: Number(v.capexCost) || 0,
      persistenceFactor: Number(v.persistenceFactor) || 1,
      include: initial?.include ?? true,
    })
    onClose()
  }

  const grouped = groupBy(COMMERCIAL_CRM_LIBRARY, 'category')

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="CRM type">
        <Select value={v.crmType} onChange={e => pickLibEntry(e.target.value)} required>
          <option value="">— select a measure —</option>
          {Object.entries(grouped).map(([cat, items]) => (
            <optgroup key={cat} label={cat.replace(/_/g, ' ')}>
              {items.map(it => <option key={it.type} value={it.type}>{it.type}</option>)}
            </optgroup>
          ))}
        </Select>
      </Field>

      {v.crmType && (<>
        <Field label="Description">
          <Input value={v.description} onChange={e => set('description', e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`Reduction % (auto: ${v.reductionPctAuto != null ? (v.reductionPctAuto * 100).toFixed(0) : '—'}%)`}
                 hint="Leave blank to use library default">
            <Input type="number" min="0" max="100" step="0.1"
              value={v.reductionPctManualPct}
              onChange={e => set('reductionPctManualPct', e.target.value)}
              placeholder={v.reductionPctAuto != null ? String(v.reductionPctAuto * 100) : 'enter %'}
            />
          </Field>
          <Field label="Persistence factor (years)">
            <Input type="number" min="1" step="0.01" value={v.persistenceFactor}
              onChange={e => set('persistenceFactor', e.target.value)} required />
          </Field>
        </div>

        {v.isFuelSwitch && (
          <div className="grid grid-cols-2 gap-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <Field label="Existing boiler efficiency (%)" hint="Default from asset">
              <Input type="number" min="1" max="200" step="0.1"
                value={v.existingEfficiencyPct}
                onChange={e => set('existingEfficiencyPct', e.target.value)} />
            </Field>
            <Field label="Proposed SCOP">
              <Select value={v.proposedSCOP} onChange={e => set('proposedSCOP', e.target.value)}>
                {COMM_SCOP_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                <option value="">Custom…</option>
              </Select>
              {v.proposedSCOP === '' && (
                <Input type="number" min="1" step="0.01" placeholder="e.g. 2.5"
                  onChange={e => set('proposedSCOP', e.target.value)} className="mt-2" />
              )}
            </Field>
          </div>
        )}

        {v.isSolarPV && (
          <Field label="Installed capacity (kWp)">
            <Input type="number" min="0" step="0.1" value={v.solarKwp}
              onChange={e => set('solarKwp', e.target.value)} placeholder="e.g. 50" required />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="CapEx cost (£)">
            <Input type="number" min="0" step="100" value={v.capexCost}
              onChange={e => set('capexCost', e.target.value)} placeholder="e.g. 50000" required />
          </Field>
          <Field label="Implementation year">
            <Input type="number" min="2024" max="2050" value={v.implementationYear}
              onChange={e => set('implementationYear', e.target.value)} />
          </Field>
        </div>

        {/* Live preview */}
        {preview && (
          <div className="grid grid-cols-4 gap-3 bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
            <div>
              <p className="text-xs text-gray-500">Gas saving</p>
              <p className="font-semibold text-sm text-gray-900">{fmtKwh(preview.savings.gasKwhSaving)}</p>
            </div>
            {preview.savings.elecKwhIncrease > 0 && (
              <div>
                <p className="text-xs text-gray-500">Elec increase</p>
                <p className="font-semibold text-sm text-amber-700">{fmtKwh(preview.savings.elecKwhIncrease)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">LTtCO₂e</p>
              <p className="font-semibold text-sm text-emerald-700">{fmtTco2(preview.ltCo2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">CCT</p>
              <p className="font-semibold text-sm text-gray-900">{fmtCct(preview.cct)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Annual saving</p>
              <p className="font-semibold text-sm text-gray-900">{fmtPounds(preview.costSave)}/yr</p>
            </div>
          </div>
        )}
      </>)}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" disabled={!v.crmType}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          Save CRM
        </button>
      </div>
    </form>
  )
}

// ─── Commercial CRM card ──────────────────────────────────────────────────────

function CommercialCRMCard({ crm, asset, audit, auditId, dispatch }) {
  const [editing, setEditing] = useState(false)
  const savings  = useMemo(() => calculateCRMSavings(crm, asset), [crm, asset])
  const ltCo2    = useMemo(() => calculateNetLtCo2(crm, asset, audit.settings), [crm, asset, audit.settings])
  const costSave = useMemo(() => calculateAnnualCostSaving(crm, asset, audit.settings), [crm, asset, audit.settings])
  const cct      = useMemo(() => calculateCCT(crm.capexCost, ltCo2), [crm.capexCost, ltCo2])

  return (
    <div className={`rounded-xl border p-4 transition-all ${crm.include ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColour(crm.crmCategory)}`}>
              {crm.crmCategory?.replace(/_/g, ' ')}
            </span>
            {crm.isFuelSwitch && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Fuel Switch</span>}
            {crm.isSolarPV && <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Solar PV</span>}
          </div>
          <p className="font-medium text-gray-900 text-sm truncate">{crm.description || crm.crmType}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-500">
            {savings.gasKwhSaving > 0 && <span>Gas: -{fmtKwh(savings.gasKwhSaving)}</span>}
            {savings.elecKwhSaving > 0 && <span>Elec: -{fmtKwh(savings.elecKwhSaving)}</span>}
            {savings.elecKwhIncrease > 0 && <span className="text-amber-600">Elec +{fmtKwh(savings.elecKwhIncrease)}</span>}
            <span className="text-emerald-600 font-medium">{fmtTco2(ltCo2)}</span>
            <span>CCT {fmtCct(cct)}</span>
            <span>{fmtPounds(costSave)}/yr</span>
            <span className="font-medium text-gray-700">CapEx {fmtGbp(crm.capexCost)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => dispatch({ type: ACTIONS.UPDATE_CRM, payload: { auditId, crm: { ...crm, include: !crm.include } } })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${crm.include ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600' : 'bg-gray-200 text-gray-500 hover:bg-emerald-100 hover:text-emerald-700'}`}
          >
            {crm.include ? 'Included' : 'Excluded'}
          </button>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-blue-600 px-1.5 py-1 rounded">Edit</button>
          <button onClick={() => confirm(`Delete "${crm.description}"?`) && dispatch({ type: ACTIONS.DELETE_CRM, payload: { auditId, crmId: crm.id } })}
            className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded">Del</button>
        </div>
      </div>
      {editing && (
        <Modal title="Edit CRM" wide onClose={() => setEditing(false)}>
          <CommercialCRMForm initial={crm} asset={asset} audit={audit}
            onSave={updated => dispatch({ type: ACTIONS.UPDATE_CRM, payload: { auditId, crm: { ...crm, ...updated } } })}
            onClose={() => setEditing(false)} />
        </Modal>
      )}
    </div>
  )
}

// ─── Commercial asset section ─────────────────────────────────────────────────

function AssetCRMSection({ asset, crms, audit, auditId, dispatch }) {
  const [adding, setAdding] = useState(false)
  const assetCrms = crms.filter(c => c.assetId === asset.id)
  const totalGasSaved = assetCrms.filter(c=>c.include).reduce((s,c) => s + calculateCRMSavings(c, asset).gasKwhSaving, 0)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <div>
          <span className="text-sm font-medium text-gray-800">{asset.description || asset.assetRef}</span>
          <span className="text-xs text-gray-400 ml-2">
            {fmtKwh(asset.annualKwhConsumed)} {asset.energySource}
            {totalGasSaved > 0 && <span className="text-emerald-600 ml-1">→ saving {fmtKwh(totalGasSaved)}</span>}
          </span>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add CRM
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {assetCrms.length === 0
          ? <p className="text-xs text-gray-400 italic px-1">No measures added yet.</p>
          : assetCrms.map(crm => (
              <CommercialCRMCard key={crm.id} crm={crm} asset={asset}
                audit={audit} auditId={auditId} dispatch={dispatch} />
            ))
        }
      </div>
      {adding && (
        <Modal title="Add CRM" wide onClose={() => setAdding(false)}>
          <CommercialCRMForm asset={asset} audit={audit}
            onSave={crm => dispatch({ type: ACTIONS.ADD_CRM, payload: { auditId, crm: { id: uid(), assetId: asset.id, buildingId: asset.buildingId, siteId: asset.siteId, ...crm } } })}
            onClose={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  )
}

// ─── Residential CRM form ─────────────────────────────────────────────────────

const RES_DEFAULTS = {
  crmType: '', category: '', description: '',
  capexCost: '', reductionPct: '', persistenceFactor: '',
  isFuelSwitch: false, proposedSCOP: '',
  isSolarPV: false, solarKwp: '',
}

function ResidentialCRMForm({ initial, property, audit, onSave, onClose }) {
  const libEntry = type => RESIDENTIAL_CRM_LIBRARY.find(e => e.type === type)
  const initVals = initial ? {
    ...RES_DEFAULTS,
    ...initial,
    reductionPct: initial.reductionPct != null ? String(initial.reductionPct * 100) : '',
    proposedSCOP: initial.proposedSCOP != null ? String(initial.proposedSCOP) : '',
    capexCost:    initial.capexCost   != null ? String(initial.capexCost) : '',
    persistenceFactor: initial.persistenceFactor != null ? String(initial.persistenceFactor) : '',
  } : { ...RES_DEFAULTS }

  const [v, setV] = useState(initVals)
  const set = (k, val) => setV(p => ({ ...p, [k]: val }))

  function pickLibEntry(type) {
    const e = libEntry(type)
    if (!e) return
    setV(p => ({
      ...p,
      crmType: e.type, category: e.category, description: e.type,
      capexCost: String(e.benchmarkCost || ''),
      reductionPct: e.benchmarkReductionPct != null ? String(e.benchmarkReductionPct * 100) : '',
      persistenceFactor: String(e.persistence),
      isFuelSwitch: e.isFuelSwitch || false,
      isSolarPV: e.isSolarPV || false,
      proposedSCOP: e.defaultSCOP != null ? String(e.defaultSCOP) : '',
    }))
  }

  // Live preview
  const preview = useMemo(() => {
    if (!v.crmType || !property) return null
    const tempCrm = {
      isFuelSwitch: v.isFuelSwitch, isSolarPV: v.isSolarPV,
      reductionPct: Number(v.reductionPct) / 100 || 0,
      proposedSCOP: v.proposedSCOP !== '' ? Number(v.proposedSCOP) : null,
      solarKwp: v.isSolarPV ? Number(v.solarKwp) : null,
      persistenceFactor: Number(v.persistenceFactor) || 1,
      crmType: v.crmType, category: v.category,
      capexCost: Number(v.capexCost) || 0,
    }
    try {
      const { kwhReduction, billSavingPence } = calculateResidentialCRMSavings(tempCrm, property)
      const ltCo2 = calculateResidentialLtCo2(tempCrm, property, audit.settings)
      const grants = checkGrantEligibility(property, tempCrm)
      const totalGrant = grants.reduce((s, g) => s + (g.value || 0), 0)
      const netCost = (Number(v.capexCost) || 0) - totalGrant
      const payback = billSavingPence > 0 ? netCost / (billSavingPence / 100) : null
      return { kwhReduction, billSavingPence, ltCo2, grants, totalGrant, netCost, payback }
    } catch { return null }
  }, [v, property, audit.settings])

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      crmType: v.crmType, category: v.category, description: v.description,
      capexCost: Number(v.capexCost) || 0,
      reductionPct: Number(v.reductionPct) / 100 || 0,
      persistenceFactor: Number(v.persistenceFactor) || 1,
      isFuelSwitch: v.isFuelSwitch,
      proposedSCOP: v.proposedSCOP !== '' ? Number(v.proposedSCOP) : null,
      isSolarPV: v.isSolarPV,
      solarKwp: v.isSolarPV ? Number(v.solarKwp) || null : null,
      include: initial?.include ?? true,
    })
    onClose()
  }

  const grouped = groupBy(RESIDENTIAL_CRM_LIBRARY, 'category')

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="CRM type">
        <Select value={v.crmType} onChange={e => pickLibEntry(e.target.value)} required>
          <option value="">— select a measure —</option>
          {Object.entries(grouped).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map(it => <option key={it.type} value={it.type}>{it.type}</option>)}
            </optgroup>
          ))}
        </Select>
      </Field>

      {v.crmType && (<>
        <Field label="Description">
          <Input value={v.description} onChange={e => set('description', e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="CapEx cost (£)" hint="Benchmark pre-filled; override with real quote">
            <Input type="number" min="0" step="50" value={v.capexCost}
              onChange={e => set('capexCost', e.target.value)} required />
          </Field>
          {!v.isFuelSwitch && !v.isSolarPV && (
            <Field label="Reduction % of baseline gas" hint="Benchmark pre-filled">
              <Input type="number" min="0" max="100" step="0.1" value={v.reductionPct}
                onChange={e => set('reductionPct', e.target.value)} />
            </Field>
          )}
          <Field label="Persistence (years)">
            <Input type="number" min="1" step="1" value={v.persistenceFactor}
              onChange={e => set('persistenceFactor', e.target.value)} required />
          </Field>
        </div>

        {v.isFuelSwitch && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <Field label="Proposed SCOP">
              <Select value={v.proposedSCOP} onChange={e => set('proposedSCOP', e.target.value)}>
                {RES_SCOP_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                <option value="">Custom…</option>
              </Select>
              {v.proposedSCOP === '' && (
                <Input type="number" min="1" step="0.01" placeholder="e.g. 2.5"
                  onChange={e => set('proposedSCOP', e.target.value)} className="mt-2" />
              )}
            </Field>
          </div>
        )}

        {v.isSolarPV && (
          <Field label="Installed capacity (kWp)">
            <Input type="number" min="0" step="0.1" value={v.solarKwp}
              onChange={e => set('solarKwp', e.target.value)} placeholder="e.g. 4" required />
          </Field>
        )}

        {/* Grants preview */}
        {preview?.grants?.length > 0 && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs font-semibold text-green-800 mb-2">Applicable grants</p>
            <div className="flex flex-wrap gap-2">
              {preview.grants.map(g => (
                <span key={g.name} className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  {g.name}{g.value != null ? ` – ${fmtGbp(g.value)}` : ''}
                  {g.note ? ` (${g.note})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live preview */}
        {preview && (
          <div className="grid grid-cols-4 gap-3 bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
            <div>
              <p className="text-xs text-gray-500">kWh saving</p>
              <p className="font-semibold text-sm text-gray-900">{fmtKwh(preview.kwhReduction)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Bill saving</p>
              <p className="font-semibold text-sm text-emerald-700">{fmtPounds(preview.billSavingPence)}/yr</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">LTtCO₂e</p>
              <p className="font-semibold text-sm text-gray-900">{fmtTco2(preview.ltCo2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payback</p>
              <p className="font-semibold text-sm text-gray-900">
                {preview.payback != null ? `${preview.payback.toFixed(1)} yrs` : '—'}
              </p>
            </div>
          </div>
        )}
      </>)}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button type="submit" disabled={!v.crmType}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          Save CRM
        </button>
      </div>
    </form>
  )
}

// ─── Residential CRM card ─────────────────────────────────────────────────────

function ResidentialCRMCard({ crm, property, audit, auditId, dispatch }) {
  const [editing, setEditing] = useState(false)
  const { kwhReduction, billSavingPence } = useMemo(() => calculateResidentialCRMSavings(crm, property), [crm, property])
  const ltCo2  = useMemo(() => calculateResidentialLtCo2(crm, property, audit.settings), [crm, property, audit.settings])
  const grants  = useMemo(() => checkGrantEligibility(property, crm), [property, crm])
  const totalGrant = grants.reduce((s, g) => s + (g.value || 0), 0)
  const netCost = crm.capexCost - totalGrant
  const payback = billSavingPence > 0 ? netCost / (billSavingPence / 100) : null

  return (
    <div className={`rounded-xl border p-4 transition-all ${crm.include ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColour(crm.category)}`}>
              {crm.category}
            </span>
            {crm.isFuelSwitch && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Fuel Switch</span>}
            {crm.isSolarPV && <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Solar PV</span>}
          </div>
          <p className="font-medium text-gray-900 text-sm">{crm.description || crm.crmType}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-500">
            <span>{fmtGbp(crm.capexCost)} capex</span>
            {totalGrant > 0 && <span className="text-green-600">− {fmtGbp(totalGrant)} grant</span>}
            {totalGrant > 0 && <span className="font-medium text-gray-800">= {fmtGbp(netCost)} net</span>}
            <span className="text-emerald-600 font-medium">{fmtPounds(billSavingPence)}/yr</span>
            {payback != null && <span>{payback.toFixed(1)} yr payback</span>}
            <span>{fmtTco2(ltCo2)}</span>
          </div>
          {grants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {grants.map(g => (
                <span key={g.name} className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                  {g.name}{g.value != null ? `: ${fmtGbp(g.value)}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => dispatch({ type: ACTIONS.UPDATE_CRM, payload: { auditId, crm: { ...crm, include: !crm.include } } })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${crm.include ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600' : 'bg-gray-200 text-gray-500 hover:bg-emerald-100 hover:text-emerald-700'}`}
          >
            {crm.include ? 'Included' : 'Excluded'}
          </button>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-blue-600 px-1.5 py-1 rounded">Edit</button>
          <button onClick={() => confirm(`Delete "${crm.description}"?`) && dispatch({ type: ACTIONS.DELETE_CRM, payload: { auditId, crmId: crm.id } })}
            className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded">Del</button>
        </div>
      </div>
      {editing && (
        <Modal title="Edit CRM" wide onClose={() => setEditing(false)}>
          <ResidentialCRMForm initial={crm} property={property} audit={audit}
            onSave={updated => dispatch({ type: ACTIONS.UPDATE_CRM, payload: { auditId, crm: { ...crm, ...updated } } })}
            onClose={() => setEditing(false)} />
        </Modal>
      )}
    </div>
  )
}

function PropertyCRMSection({ property, crms, audit, auditId, dispatch }) {
  const [adding, setAdding] = useState(false)
  const propCrms = crms.filter(c => c.propertyId === property.id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{property.address || 'Unnamed property'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {property.propertyType} · EPC {property.currentEpcRating}
            {property.baselineGasKwh > 0 && ` · ${property.baselineGasKwh.toLocaleString()} kWh gas baseline`}
          </p>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
          + Add CRM
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {propCrms.length === 0
          ? <p className="text-sm text-gray-400 italic">No measures added yet.</p>
          : propCrms.map(crm => (
              <ResidentialCRMCard key={crm.id} crm={crm} property={property}
                audit={audit} auditId={auditId} dispatch={dispatch} />
            ))
        }
      </div>
      {adding && (
        <Modal title="Add CRM" wide onClose={() => setAdding(false)}>
          <ResidentialCRMForm property={property} audit={audit}
            onSave={crm => dispatch({ type: ACTIONS.ADD_CRM, payload: { auditId, crm: { id: uid(), propertyId: property.id, auditId, ...crm } } })}
            onClose={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CRMBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useAudit()
  const audit = state.audits[id]

  if (!audit) return <Layout><div className="text-center py-20 text-gray-500">Audit not found.</div></Layout>

  const includedCrms = audit.crms.filter(c => c.include)
  const totalCapex = includedCrms.reduce((s, c) => s + (c.capexCost || 0), 0)

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">CRM Builder</h1>
            <p className="text-sm text-gray-500 mt-1">
              {audit.crms.length} measures · {includedCrms.length} included
              {totalCapex > 0 && ` · ${fmtGbp(totalCapex)} total CapEx`}
            </p>
          </div>
        </div>

        {audit.mode === 'commercial' ? (
          audit.sites.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 mb-4">No sites set up yet.</p>
              <button onClick={() => navigate(`/audit/${id}/setup`)} className="text-blue-600 hover:underline text-sm">Set up sites first</button>
            </div>
          ) : (
            audit.sites.map(site => {
              const siteBuildings = audit.buildings.filter(b => b.siteId === site.id)
              return (
                <div key={site.id} className="mb-8">
                  <h2 className="text-base font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                    {site.name}
                  </h2>
                  {siteBuildings.map(building => {
                    const bldgAssets = audit.assets.filter(a => a.buildingId === building.id)
                    return (
                      <div key={building.id} className="mb-6">
                        <p className="text-sm font-medium text-gray-600 mb-3 ml-1">{building.name}</p>
                        {bldgAssets.length === 0
                          ? <p className="text-sm text-gray-400 italic ml-2">No assets. <button onClick={() => navigate(`/audit/${id}/assets`)} className="text-blue-600 hover:underline">Add assets first.</button></p>
                          : bldgAssets.map(asset => (
                              <AssetCRMSection key={asset.id} asset={asset}
                                crms={audit.crms} audit={audit} auditId={id} dispatch={dispatch} />
                            ))
                        }
                      </div>
                    )
                  })}
                </div>
              )
            })
          )
        ) : (
          audit.properties.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 mb-4">No properties set up yet.</p>
              <button onClick={() => navigate(`/audit/${id}/setup`)} className="text-blue-600 hover:underline text-sm">Set up properties first</button>
            </div>
          ) : (
            audit.properties.map(property => (
              <PropertyCRMSection key={property.id} property={property}
                crms={audit.crms} audit={audit} auditId={id} dispatch={dispatch} />
            ))
          )
        )}

        <div className="flex justify-between pt-4 pb-8">
          <button onClick={() => navigate(`/audit/${id}/${audit.mode === 'commercial' ? 'assets' : 'setup'}`)}
            className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            ← Back
          </button>
          <button onClick={() => navigate(`/audit/${id}/results`)}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
            Next: Results →
          </button>
        </div>
      </div>
    </Layout>
  )
}
