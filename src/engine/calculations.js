import {
  CARBON_FACTORS,
  SALIX_MIN_CONTRIBUTION_PCT,
  SEG_RATE_PKWH,
  SOLAR_UK_YIELD_KWH_PER_KWP,
  SOLAR_SELF_CONSUMPTION_RATE,
} from './constants.js'

// ─── Commercial ──────────────────────────────────────────────────────────────

/**
 * Calculate annual fuel energy consumed by an asset.
 * FLEQ = Full Load Equivalent Hours = operatingHoursPerYear × loadFactor
 * Divides by efficiency to get INPUT energy (e.g. gas into a boiler).
 */
export function calculateAssetKwh(asset) {
  const { ratedKw, qty, operatingHoursPerYear, loadFactor, efficiencyPct } = asset
  const fleq = operatingHoursPerYear * loadFactor
  return (ratedKw * qty * fleq) / efficiencyPct
}

/**
 * Calculate energy savings from a commercial CRM applied to an asset.
 * For fuel-switch CRMs (heat pumps): gas saving drives an electricity increase.
 * Returns { gasKwhSaving, elecKwhSaving, elecKwhIncrease }
 */
export function calculateCRMSavings(crm, asset) {
  const reductionPct = crm.reductionPctManual ?? crm.reductionPctAuto ?? 0
  const baselineKwh = asset.annualKwhConsumed

  if (crm.isFuelSwitch) {
    const gasKwhSaving = baselineKwh * reductionPct
    const scop = crm.proposedSCOPManual ?? crm.proposedSCOP ?? 1
    const heatDeliveredKwh = gasKwhSaving * (crm.existingEfficiency ?? asset.efficiencyPct)
    const elecKwhIncrease = heatDeliveredKwh / scop
    return { gasKwhSaving, elecKwhSaving: 0, elecKwhIncrease }
  }

  const utility = crm.utility ?? 'gas'
  const kwhSaving = baselineKwh * reductionPct
  return {
    gasKwhSaving:   utility === 'gas'  ? kwhSaving : 0,
    elecKwhSaving:  utility === 'elec' ? kwhSaving : 0,
    elecKwhIncrease: 0,
  }
}

/**
 * Calculate lifetime tCO₂e for a commercial CRM.
 * Returns { directTco2, indirectTco2 } where:
 *   directTco2   = Scope 1 (gas combustion saved)
 *   indirectTco2 = Scope 2 (electricity saved minus electricity added)
 */
export function calculateLtCo2(crm, asset, settings) {
  const gasFactor  = settings?.gasCarbonFactor  ?? CARBON_FACTORS.gas
  const elecFactor = settings?.elecCarbonFactor ?? CARBON_FACTORS.electricity
  const { gasKwhSaving, elecKwhSaving, elecKwhIncrease } = calculateCRMSavings(crm, asset)
  const p = crm.persistenceFactor

  const directTco2   = gasKwhSaving * p * gasFactor
  const indirectTco2 = (elecKwhSaving - elecKwhIncrease) * p * elecFactor

  return { directTco2, indirectTco2 }
}

/**
 * Net lifetime tCO₂e (direct + indirect, where indirect can be negative for fuel switches).
 */
export function calculateNetLtCo2(crm, asset, settings) {
  const { directTco2, indirectTco2 } = calculateLtCo2(crm, asset, settings)
  return directTco2 + indirectTco2
}

/**
 * Annual cost saving in pence.
 */
export function calculateAnnualCostSaving(crm, asset, settings) {
  const gasRate  = settings?.gasUnitRatePkWh  ?? asset.unitRatePkWh ?? 0
  const elecRate = settings?.elecUnitRatePkWh ?? crm.elecUnitRatePkWh ?? 0
  const { gasKwhSaving, elecKwhSaving, elecKwhIncrease } = calculateCRMSavings(crm, asset)

  return (gasKwhSaving * gasRate)
       + (elecKwhSaving * elecRate)
       - (elecKwhIncrease * elecRate)
}

/**
 * Carbon Cost Threshold — £ per lifetime tCO₂e (lower = more fundable via Salix).
 */
export function calculateCCT(capex, ltCo2) {
  if (!ltCo2 || ltCo2 <= 0) return null
  return capex / ltCo2
}

/**
 * Salix funding calculation.
 * Returns { fundableValue, contribution, fundingShortfall }
 */
export function calculateSalixFunding(ltCo2, salixPrice, totalCapex, likeForLikeReplacementCost) {
  const fundableValue     = ltCo2 * salixPrice
  const minContribution   = totalCapex * SALIX_MIN_CONTRIBUTION_PCT
  const contribution      = Math.max(likeForLikeReplacementCost ?? 0, minContribution)
  const fundingShortfall  = totalCapex - fundableValue - contribution
  return { fundableValue, contribution, fundingShortfall }
}

/**
 * Aggregate results for a single site.
 * Only CRMs with include=true contribute to totals.
 */
export function calculateSiteResults(site, buildings, assets, crms, settings) {
  const includedCrms = crms.filter(c => c.include && c.siteId === site.id)

  let totalCapex          = 0
  let totalGasKwhSaving   = 0
  let totalElecKwhSaving  = 0
  let totalElecKwhIncrease = 0
  let totalLtCo2          = 0

  for (const crm of includedCrms) {
    const asset = assets.find(a => a.id === crm.assetId)
    if (!asset) continue
    const savings = calculateCRMSavings(crm, asset)
    totalCapex           += crm.capexCost ?? 0
    totalGasKwhSaving    += savings.gasKwhSaving
    totalElecKwhSaving   += savings.elecKwhSaving
    totalElecKwhIncrease += savings.elecKwhIncrease
    totalLtCo2           += calculateNetLtCo2(crm, asset, settings)
  }

  const annualCostSavingPence = includedCrms.reduce((sum, crm) => {
    const asset = assets.find(a => a.id === crm.assetId)
    if (!asset) return sum
    return sum + calculateAnnualCostSaving(crm, asset, settings)
  }, 0)

  return {
    siteId: site.id,
    totalCapex,
    totalGasKwhSaving,
    totalElecKwhSaving,
    totalElecKwhIncrease,
    totalLtCo2,
    annualCostSavingPence,
    cct: calculateCCT(totalCapex, totalLtCo2),
  }
}

/**
 * Roll up all site results into a portfolio summary.
 */
export function calculatePortfolioResults(sites, allSiteResults, settings) {
  const includedResults = allSiteResults.filter((_, i) => sites[i]?.includeInPortfolio !== false)

  return includedResults.reduce((acc, r) => ({
    totalCapex:           acc.totalCapex           + r.totalCapex,
    totalGasKwhSaving:    acc.totalGasKwhSaving    + r.totalGasKwhSaving,
    totalElecKwhSaving:   acc.totalElecKwhSaving   + r.totalElecKwhSaving,
    totalElecKwhIncrease: acc.totalElecKwhIncrease + r.totalElecKwhIncrease,
    totalLtCo2:           acc.totalLtCo2           + r.totalLtCo2,
    annualCostSavingPence: acc.annualCostSavingPence + r.annualCostSavingPence,
  }), {
    totalCapex: 0, totalGasKwhSaving: 0, totalElecKwhSaving: 0,
    totalElecKwhIncrease: 0, totalLtCo2: 0, annualCostSavingPence: 0,
  })
}

// ─── Residential ─────────────────────────────────────────────────────────────

/**
 * Calculate savings from a residential CRM applied to a property.
 * Returns { kwhReduction, elecIncrease, billSavingPence }
 * billSavingPence uses pence unit rates.
 */
export function calculateResidentialCRMSavings(crm, property) {
  const gasRate  = property.gasUnitRatePkWh  ?? 0
  const elecRate = property.elecUnitRatePkWh ?? 0

  if (crm.isFuelSwitch) {
    const scop          = crm.proposedSCOP ?? 2.5
    const reductionPct  = crm.reductionPct ?? 1.0
    const kwhReduction  = property.baselineGasKwh * reductionPct
    const boilerEff     = property.boilerEfficiencyPct ?? 0.80
    const heatDelivered = kwhReduction * boilerEff
    const elecIncrease  = heatDelivered / scop
    const billSavingPence = (kwhReduction * gasRate) - (elecIncrease * elecRate)
    return { kwhReduction, elecIncrease, billSavingPence }
  }

  if (crm.isSolarPV) {
    const { selfConsumptionKwh, exportKwh } = calculateSolarYield(crm.solarKwp ?? 0)
    const billSavingPence = (selfConsumptionKwh * elecRate) + (exportKwh * SEG_RATE_PKWH)
    return { kwhReduction: selfConsumptionKwh, elecIncrease: 0, billSavingPence }
  }

  const kwhReduction    = property.baselineGasKwh * (crm.reductionPct ?? 0)
  const billSavingPence = kwhReduction * gasRate
  return { kwhReduction, elecIncrease: 0, billSavingPence }
}

/**
 * Lifetime tCO₂e for a residential CRM.
 */
export function calculateResidentialLtCo2(crm, property, settings) {
  const gasFactor  = settings?.gasCarbonFactor  ?? CARBON_FACTORS.gas
  const elecFactor = settings?.elecCarbonFactor ?? CARBON_FACTORS.electricity
  const { kwhReduction, elecIncrease } = calculateResidentialCRMSavings(crm, property)
  const p = crm.persistenceFactor ?? 1

  if (crm.isFuelSwitch) {
    return (kwhReduction * gasFactor - elecIncrease * elecFactor) * p
  }
  return kwhReduction * p * gasFactor
}

/**
 * Simple payback in years = netCost / (annualBillSaving in £).
 * Inputs use pence for billSavingPence.
 */
export function calculateResidentialPayback(crm) {
  const netCost = crm.netCost ?? crm.capexCost ?? 0
  const annualSavingPounds = (crm.annualBillSaving ?? 0) / 100
  if (!annualSavingPounds || annualSavingPounds <= 0) return null
  return netCost / annualSavingPounds
}

/**
 * Aggregate results for a single property.
 * Only CRMs with include=true are counted.
 */
export function calculatePropertyResults(property, crms, settings) {
  const includedCrms = crms.filter(c => c.include && c.propertyId === property.id)

  let totalCapex         = 0
  let totalGrantAvail    = 0
  let totalKwhReduction  = 0
  let totalElecIncrease  = 0
  let totalBillSavingP   = 0
  let totalLtCo2         = 0

  for (const crm of includedCrms) {
    const { kwhReduction, elecIncrease, billSavingPence } = calculateResidentialCRMSavings(crm, property)
    totalCapex        += crm.capexCost     ?? 0
    totalGrantAvail   += crm.grantAvailable ?? 0
    totalKwhReduction += kwhReduction
    totalElecIncrease += elecIncrease
    totalBillSavingP  += billSavingPence
    totalLtCo2        += calculateResidentialLtCo2(crm, property, settings)
  }

  const netCost = totalCapex - totalGrantAvail
  const simplePaybackYears = totalBillSavingP > 0
    ? netCost / (totalBillSavingP / 100)
    : null

  return {
    propertyId: property.id,
    totalCapex,
    totalGrantAvail,
    netCost,
    totalKwhReduction,
    totalElecIncrease,
    totalBillSavingPence: totalBillSavingP,
    totalLtCo2,
    simplePaybackYears,
  }
}

/**
 * Check grant eligibility for a residential property + CRM combination.
 * Returns array of applicable grants.
 */
export function checkGrantEligibility(property, crm) {
  const grants = []
  const isHeatPump = crm.crmType?.toLowerCase().includes('heat pump')
  const isFabric   = crm.category === 'Fabric'
  const isSolar    = crm.isSolarPV

  if (isHeatPump && !['F', 'G'].includes(property.currentEpcRating)) {
    grants.push({ name: 'Boiler Upgrade Scheme (BUS)', value: 7500 })
  }

  if (property.isOffGasGrid && (isFabric || isHeatPump)) {
    grants.push({ name: 'Home Upgrade Grant (HUG2)', value: null, note: 'Contact local authority — value varies' })
  }

  if (isHeatPump || isFabric || isSolar) {
    grants.push({ name: '0% VAT relief', value: (crm.capexCost ?? 0) * 0.20, note: 'Saving vs 20% standard rate' })
  }

  return grants
}

// ─── Shared ──────────────────────────────────────────────────────────────────

/**
 * Solar PV yield calculation.
 * orientation: 'south' (default, 0 adj), 'east'/'west' (-100), 'north' (-200)
 * Returns { annualKwh, selfConsumptionKwh, exportKwh }
 */
export function calculateSolarYield(kwp, orientation = 'south') {
  const adjustments = { south: 0, east: -100, west: -100, north: -200 }
  const yieldPerKwp = SOLAR_UK_YIELD_KWH_PER_KWP + (adjustments[orientation] ?? 0)
  const annualKwh          = kwp * yieldPerKwp
  const selfConsumptionKwh = annualKwh * SOLAR_SELF_CONSUMPTION_RATE
  const exportKwh          = annualKwh - selfConsumptionKwh
  return { annualKwh, selfConsumptionKwh, exportKwh }
}
