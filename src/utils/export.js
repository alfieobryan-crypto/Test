import {
  calculateCRMSavings, calculateNetLtCo2, calculateAnnualCostSaving, calculateCCT,
  calculateResidentialCRMSavings, calculateResidentialLtCo2, checkGrantEligibility,
} from '../engine/calculations.js'

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function esc(v) {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}
function row(cells) { return cells.map(esc).join(',') }
function download(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Commercial CSV ───────────────────────────────────────────────────────────

export function exportCommercialCSV(audit) {
  const s = audit.settings
  const headers = [
    'Site','Building','Asset Ref','Asset Description','SEU','Energy Source',
    'Asset kWh/yr','CRM Type','CRM Category','Description','Include',
    'Reduction %','CapEx £','Persistence yrs','Gas kWh Saving','Elec kWh Increase',
    'Net LTtCO2e t','Annual Cost Saving £','CCT £/tCO2e','Implementation Year',
  ]
  const rows = [row(headers)]

  for (const crm of audit.crms) {
    const asset    = audit.assets.find(a => a.id === crm.assetId)
    const building = audit.buildings.find(b => b.id === crm.buildingId)
    const site     = audit.sites.find(s => s.id === crm.siteId)
    if (!asset) continue
    const savings  = calculateCRMSavings(crm, asset)
    const ltCo2    = calculateNetLtCo2(crm, asset, s)
    const costSave = calculateAnnualCostSaving(crm, asset, s)
    const cct      = calculateCCT(crm.capexCost, ltCo2)
    const reductionPct = ((crm.reductionPctManual ?? crm.reductionPctAuto ?? 0) * 100).toFixed(1)

    rows.push(row([
      site?.name, building?.name, asset.assetRef, asset.description, asset.seu, asset.energySource,
      Math.round(asset.annualKwhConsumed),
      crm.crmType, crm.crmCategory, crm.description, crm.include ? 'Yes' : 'No',
      reductionPct, crm.capexCost, crm.persistenceFactor,
      Math.round(savings.gasKwhSaving), Math.round(savings.elecKwhIncrease),
      ltCo2.toFixed(2), Math.round(costSave / 100),
      cct != null ? cct.toFixed(0) : '', crm.implementationYear,
    ]))
  }

  download(`${audit.client?.name || 'audit'}-commercial-crms.csv`, rows.join('\n'))
}

// ─── Residential CSV ──────────────────────────────────────────────────────────

export function exportResidentialCSV(audit) {
  const headers = [
    'Property','EPC','CRM Type','Category','Description','Include',
    'CapEx £','Total Grant £','Net Cost £','kWh Reduction','Bill Saving £/yr',
    'LTtCO2e t','Payback yrs','Persistence yrs','Grants',
  ]
  const rows = [row(headers)]

  for (const crm of audit.crms) {
    const property = audit.properties.find(p => p.id === crm.propertyId)
    if (!property) continue
    const { kwhReduction, billSavingPence } = calculateResidentialCRMSavings(crm, property)
    const ltCo2  = calculateResidentialLtCo2(crm, property, audit.settings)
    const grants = checkGrantEligibility(property, crm)
    const totalGrant = grants.reduce((s, g) => s + (g.value || 0), 0)
    const netCost  = crm.capexCost - totalGrant
    const payback  = billSavingPence > 0 ? (netCost / (billSavingPence / 100)).toFixed(1) : ''
    const grantNames = grants.map(g => g.name).join('; ')

    rows.push(row([
      property.address, property.currentEpcRating,
      crm.crmType, crm.category, crm.description, crm.include ? 'Yes' : 'No',
      crm.capexCost, totalGrant.toFixed(0), netCost.toFixed(0),
      Math.round(kwhReduction), Math.round(billSavingPence / 100),
      ltCo2.toFixed(2), payback, crm.persistenceFactor, grantNames,
    ]))
  }

  download(`${audit.client?.name || 'audit'}-residential-crms.csv`, rows.join('\n'))
}

export function exportCSV(audit) {
  if (audit.mode === 'commercial') exportCommercialCSV(audit)
  else exportResidentialCSV(audit)
}

// ─── Print to PDF ─────────────────────────────────────────────────────────────

export function printReport() {
  window.print()
}
