import { describe, it, expect } from 'vitest'
import {
  calculateAssetKwh,
  calculateCRMSavings,
  calculateLtCo2,
  calculateNetLtCo2,
  calculateAnnualCostSaving,
  calculateCCT,
  calculateSalixFunding,
  calculateSiteResults,
  calculateResidentialCRMSavings,
  calculateResidentialLtCo2,
  calculateResidentialPayback,
  calculatePropertyResults,
  checkGrantEligibility,
  calculateSolarYield,
} from './calculations.js'
import { CARBON_FACTORS, OPERATING_PATTERNS } from './constants.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Hoval SR Plus 400 — 1200kW, 80% efficiency, Office Hours 5 day, load factor 0.2
const hovalBoiler = {
  id: 'asset-1',
  ratedKw: 1200,
  qty: 1,
  efficiencyPct: 0.8,
  operatingPattern: 'Office Hours 5 day',
  operatingHoursPerYear: OPERATING_PATTERNS['Office Hours 5 day'], // 3120
  loadFactor: 0.2,
  energySource: 'Natural Gas',
  unitRatePkWh: 6,  // 6p/kWh gas
}

const defaultSettings = {
  gasCarbonFactor:  CARBON_FACTORS.gas,
  elecCarbonFactor: CARBON_FACTORS.electricity,
  gasUnitRatePkWh:  6,
  elecUnitRatePkWh: 28,
}

// ─── Commercial: Asset kWh ────────────────────────────────────────────────────

describe('calculateAssetKwh', () => {
  it('Hoval SR Plus 400 boiler → ~936,000 kWh/yr gas', () => {
    // FLEQ = 3120 × 0.2 = 624 hrs
    // annualKwh = 1200 × 1 × 624 / 0.8 = 936,000
    const result = calculateAssetKwh(hovalBoiler)
    expect(result).toBeCloseTo(936000, 0)
  })

  it('24/7 operation, single 10kW unit, 100% efficiency, 100% load → 87,360 kWh', () => {
    const asset = { ratedKw: 10, qty: 1, operatingHoursPerYear: 8736, loadFactor: 1.0, efficiencyPct: 1.0 }
    expect(calculateAssetKwh(asset)).toBeCloseTo(87360, 0)
  })

  it('load factor scales output proportionally', () => {
    const base = { ratedKw: 100, qty: 1, operatingHoursPerYear: 4000, efficiencyPct: 1.0, loadFactor: 1.0 }
    const half = { ...base, loadFactor: 0.5 }
    expect(calculateAssetKwh(base)).toBeCloseTo(2 * calculateAssetKwh(half), 5)
  })

  it('qty multiplies output linearly', () => {
    const single = { ratedKw: 100, qty: 1, operatingHoursPerYear: 3000, loadFactor: 0.5, efficiencyPct: 0.9 }
    const triple = { ...single, qty: 3 }
    expect(calculateAssetKwh(triple)).toBeCloseTo(3 * calculateAssetKwh(single), 5)
  })

  it('lower efficiency means higher fuel consumption', () => {
    const eff80 = { ratedKw: 500, qty: 1, operatingHoursPerYear: 3120, loadFactor: 0.3, efficiencyPct: 0.80 }
    const eff95 = { ...eff80, efficiencyPct: 0.95 }
    expect(calculateAssetKwh(eff80)).toBeGreaterThan(calculateAssetKwh(eff95))
  })
})

// ─── Commercial: CRM Savings ─────────────────────────────────────────────────

describe('calculateCRMSavings — non-fuel-switch', () => {
  const boilerWithKwh = { ...hovalBoiler, annualKwhConsumed: 936000 }

  it('35% BEMS reduction on gas boiler → 327,600 kWh gas saving', () => {
    const crm = { reductionPctAuto: 0.35, reductionPctManual: null, isFuelSwitch: false, utility: 'gas', persistenceFactor: 8.42 }
    const result = calculateCRMSavings(crm, boilerWithKwh)
    expect(result.gasKwhSaving).toBeCloseTo(936000 * 0.35, 0)
    expect(result.elecKwhSaving).toBe(0)
    expect(result.elecKwhIncrease).toBe(0)
  })

  it('manual override takes precedence over auto reduction', () => {
    const crm = { reductionPctAuto: 0.35, reductionPctManual: 0.20, isFuelSwitch: false, utility: 'gas', persistenceFactor: 8.42 }
    const result = calculateCRMSavings(crm, boilerWithKwh)
    expect(result.gasKwhSaving).toBeCloseTo(936000 * 0.20, 0)
  })

  it('LED upgrade → elec saving, zero gas saving', () => {
    const elecAsset = { ...boilerWithKwh, annualKwhConsumed: 50000 }
    const crm = { reductionPctAuto: 0.50, reductionPctManual: null, isFuelSwitch: false, utility: 'elec', persistenceFactor: 25 }
    const result = calculateCRMSavings(crm, elecAsset)
    expect(result.elecKwhSaving).toBeCloseTo(25000, 0)
    expect(result.gasKwhSaving).toBe(0)
  })
})

describe('calculateCRMSavings — fuel switch (ASHP)', () => {
  // Spec reference: 486,081 kWh gas saving, ~167,342 kWh elec increase at sCOP 2.32
  // These numbers are internally consistent: 486,081 × 0.8 / 2.32 ≈ 167,614
  // The spec uses sCOP 2.32 as approximate; we test the formula logic here.
  const asset = {
    annualKwhConsumed: 607_601,  // baseline that yields 486,081 at 80% replacement
    efficiencyPct: 0.8,
    unitRatePkWh: 6,
  }

  it('ASHP 80% gas replacement: gas saving = baselineKwh × 0.8', () => {
    const crm = {
      reductionPctAuto: 0.8, reductionPctManual: null,
      isFuelSwitch: true, existingEfficiency: 0.8, proposedSCOP: 2.32, persistenceFactor: 20,
    }
    const result = calculateCRMSavings(crm, asset)
    expect(result.gasKwhSaving).toBeCloseTo(607_601 * 0.8, 0)
    expect(result.elecKwhIncrease).toBeGreaterThan(0)
    expect(result.elecKwhSaving).toBe(0)
  })

  it('ASHP fuel switch: elecKwhIncrease = gasKwhSaving × boilerEff / sCOP', () => {
    const crm = {
      reductionPctAuto: 0.8, reductionPctManual: null,
      isFuelSwitch: true, existingEfficiency: 0.8, proposedSCOP: 2.32, persistenceFactor: 20,
    }
    const result = calculateCRMSavings(crm, asset)
    const expectedHeat = result.gasKwhSaving * 0.8
    const expectedElec = expectedHeat / 2.32
    expect(result.elecKwhIncrease).toBeCloseTo(expectedElec, 0)
  })

  it('spec reference: 486,081 gas saving → ~167,614 elec increase at sCOP 2.32, eff 0.8', () => {
    // heatDelivered = 486,081 × 0.8 = 388,865; elec = 388,865 / 2.32 = 167,614
    const crm = {
      reductionPctAuto: 1.0, reductionPctManual: null,
      isFuelSwitch: true, existingEfficiency: 0.8, proposedSCOP: 2.32, persistenceFactor: 20,
    }
    const assetWith486 = { ...asset, annualKwhConsumed: 486_081 }
    const result = calculateCRMSavings(crm, assetWith486)
    expect(result.gasKwhSaving).toBeCloseTo(486_081, 0)
    expect(result.elecKwhIncrease).toBeCloseTo(486_081 * 0.8 / 2.32, 0) // ~167,614
  })

  it('higher sCOP means less electricity needed', () => {
    const crmLow  = { reductionPctAuto: 0.8, isFuelSwitch: true, existingEfficiency: 0.8, proposedSCOP: 2.4, persistenceFactor: 20 }
    const crmHigh = { ...crmLow, proposedSCOP: 3.2 }
    const a = { annualKwhConsumed: 100_000, efficiencyPct: 0.8 }
    expect(calculateCRMSavings(crmLow, a).elecKwhIncrease)
      .toBeGreaterThan(calculateCRMSavings(crmHigh, a).elecKwhIncrease)
  })
})

// ─── Commercial: LTtCO₂e ─────────────────────────────────────────────────────

describe('calculateLtCo2 / calculateNetLtCo2', () => {
  const settings = defaultSettings

  it('spec reference: 486,081 kWh gas saving × 20 yr × 0.00018387 → ~1,788 tCO₂e direct', () => {
    // 486,081 × 20 × 0.00018387 = 1,787.7 ≈ 1,788
    const asset = { annualKwhConsumed: 486_081, efficiencyPct: 1.0 }
    const crm = {
      reductionPctAuto: 1.0, reductionPctManual: null,
      isFuelSwitch: false, utility: 'gas', persistenceFactor: 20,
    }
    const { directTco2 } = calculateLtCo2(crm, asset, settings)
    expect(directTco2).toBeCloseTo(1787.7, 0)
  })

  it('fuel switch: net LTtCO₂e = (gasKwhSaving × gasFactor - elecIncrease × elecFactor) × persistence', () => {
    const asset = { annualKwhConsumed: 936_000, efficiencyPct: 0.8 }
    const crm = {
      reductionPctAuto: 0.8, reductionPctManual: null,
      isFuelSwitch: true, existingEfficiency: 0.8, proposedSCOP: 2.4, persistenceFactor: 20,
    }
    const { gasKwhSaving, elecKwhIncrease } = calculateCRMSavings(crm, asset)
    const expectedNet = (gasKwhSaving * CARBON_FACTORS.gas - elecKwhIncrease * CARBON_FACTORS.electricity) * 20
    expect(calculateNetLtCo2(crm, asset, settings)).toBeCloseTo(expectedNet, 2)
  })

  it('elec-saving CRM: only indirectTco2 is non-zero', () => {
    const asset = { annualKwhConsumed: 50_000, efficiencyPct: 1.0 }
    const crm = { reductionPctAuto: 0.5, isFuelSwitch: false, utility: 'elec', persistenceFactor: 25 }
    const { directTco2, indirectTco2 } = calculateLtCo2(crm, asset, settings)
    expect(directTco2).toBe(0)
    expect(indirectTco2).toBeCloseTo(25_000 * 25 * CARBON_FACTORS.electricity, 2)
  })
})

// ─── Commercial: Cost Saving ─────────────────────────────────────────────────

describe('calculateAnnualCostSaving', () => {
  it('gas saving at 6p/kWh → correct pence total', () => {
    const asset = { annualKwhConsumed: 100_000, efficiencyPct: 1.0, unitRatePkWh: 6 }
    const crm  = { reductionPctAuto: 0.10, isFuelSwitch: false, utility: 'gas', persistenceFactor: 10 }
    const saving = calculateAnnualCostSaving(crm, asset, defaultSettings)
    expect(saving).toBeCloseTo(10_000 * 6, 0)   // 60,000 pence = £600
  })

  it('fuel switch: gas saving minus elec cost increase', () => {
    const asset = { annualKwhConsumed: 100_000, efficiencyPct: 0.8 }
    const crm  = {
      reductionPctAuto: 1.0, isFuelSwitch: true,
      existingEfficiency: 0.8, proposedSCOP: 3.0, persistenceFactor: 20,
    }
    const { gasKwhSaving, elecKwhIncrease } = calculateCRMSavings(crm, asset)
    const expected = (gasKwhSaving * 6) - (elecKwhIncrease * 28)
    expect(calculateAnnualCostSaving(crm, asset, defaultSettings)).toBeCloseTo(expected, 1)
  })
})

// ─── Commercial: CCT & Salix ─────────────────────────────────────────────────

describe('calculateCCT', () => {
  it('capex £50,000 / 500 tCO₂e → £100/tCO₂e', () => {
    expect(calculateCCT(50_000, 500)).toBeCloseTo(100, 4)
  })

  it('returns null when ltCo2 is zero', () => {
    expect(calculateCCT(50_000, 0)).toBeNull()
  })
})

describe('calculateSalixFunding', () => {
  it('fundableValue = ltCo2 × salixPrice', () => {
    const { fundableValue } = calculateSalixFunding(500, 95, 60_000, 5_000)
    expect(fundableValue).toBeCloseTo(500 * 95, 2)
  })

  it('contribution uses like-for-like when it exceeds 12% of capex', () => {
    // 12% of 60,000 = 7,200; likeForLike = 10,000 → contribution = 10,000
    const { contribution } = calculateSalixFunding(500, 95, 60_000, 10_000)
    expect(contribution).toBe(10_000)
  })

  it('contribution uses 12% minimum when likeForLike is lower', () => {
    // 12% of 60,000 = 7,200; likeForLike = 3,000 → contribution = 7,200
    const { contribution } = calculateSalixFunding(500, 95, 60_000, 3_000)
    expect(contribution).toBeCloseTo(60_000 * 0.12, 2)
  })

  it('fundingShortfall = capex - fundableValue - contribution', () => {
    const capex = 60_000, ltCo2 = 500, price = 95, lfr = 5_000
    const { fundableValue, contribution, fundingShortfall } = calculateSalixFunding(ltCo2, price, capex, lfr)
    expect(fundingShortfall).toBeCloseTo(capex - fundableValue - contribution, 2)
  })
})

// ─── Residential: CRM Savings ────────────────────────────────────────────────

describe('calculateResidentialCRMSavings', () => {
  const property = {
    id: 'prop-1',
    baselineGasKwh: 15_000,
    baselineElecKwh: 3_500,
    gasUnitRatePkWh: 5.8,
    elecUnitRatePkWh: 28,
    boilerEfficiencyPct: 0.80,
    currentEpcRating: 'D',
    isOffGasGrid: false,
  }

  it('spec reference: 15,000 kWh gas, loft insulation 15% → 2,250 kWh saving', () => {
    const crm = { isFuelSwitch: false, isSolarPV: false, reductionPct: 0.15, persistenceFactor: 42 }
    const { kwhReduction } = calculateResidentialCRMSavings(crm, property)
    expect(kwhReduction).toBeCloseTo(2_250, 0)
  })

  it('spec reference: 2,250 kWh at 5.8p → £130.50/yr bill saving', () => {
    const crm = { isFuelSwitch: false, isSolarPV: false, reductionPct: 0.15, persistenceFactor: 42 }
    const { billSavingPence } = calculateResidentialCRMSavings(crm, property)
    expect(billSavingPence).toBeCloseTo(2_250 * 5.8, 1)  // 13,050p = £130.50
  })

  it('ASHP fuel switch: gas saving, elec increase, net bill saving', () => {
    const crm = { isFuelSwitch: true, isSolarPV: false, reductionPct: 1.0, proposedSCOP: 2.5, persistenceFactor: 20 }
    const { kwhReduction, elecIncrease, billSavingPence } = calculateResidentialCRMSavings(crm, property)
    // gasKwhReduction = 15,000; heatDelivered = 15,000 × 0.8 = 12,000; elecIncrease = 12,000 / 2.5 = 4,800
    expect(kwhReduction).toBeCloseTo(15_000, 0)
    expect(elecIncrease).toBeCloseTo(4_800, 0)
    const expectedBill = (15_000 * 5.8) - (4_800 * 28)
    expect(billSavingPence).toBeCloseTo(expectedBill, 1)
  })

  it('solar PV: returns self-consumption as kwhReduction, no elec increase', () => {
    const crm = { isFuelSwitch: false, isSolarPV: true, solarKwp: 4, persistenceFactor: 25 }
    const { kwhReduction, elecIncrease } = calculateResidentialCRMSavings(crm, property)
    // 4kWp × 850 = 3,400 kWh/yr; selfConsumption = 3,400 × 0.40 = 1,360
    expect(kwhReduction).toBeCloseTo(1_360, 0)
    expect(elecIncrease).toBe(0)
  })
})

// ─── Residential: LTtCO₂e ────────────────────────────────────────────────────

describe('calculateResidentialLtCo2', () => {
  const property = {
    id: 'prop-1', baselineGasKwh: 15_000, boilerEfficiencyPct: 0.80,
    gasUnitRatePkWh: 5.8, elecUnitRatePkWh: 28,
  }

  it('loft insulation: 2,250 kWh × 42 yrs × gasFactor → ~17.35 tCO₂e', () => {
    const crm = { isFuelSwitch: false, isSolarPV: false, reductionPct: 0.15, persistenceFactor: 42 }
    const expected = 2_250 * 42 * CARBON_FACTORS.gas
    expect(calculateResidentialLtCo2(crm, property, defaultSettings)).toBeCloseTo(expected, 3)
  })

  it('ASHP: net CO₂e accounts for elec emissions added', () => {
    const crm = { isFuelSwitch: true, isSolarPV: false, reductionPct: 1.0, proposedSCOP: 2.5, persistenceFactor: 20 }
    const { kwhReduction, elecIncrease } = calculateResidentialCRMSavings(crm, property)
    const expected = (kwhReduction * CARBON_FACTORS.gas - elecIncrease * CARBON_FACTORS.electricity) * 20
    expect(calculateResidentialLtCo2(crm, property, defaultSettings)).toBeCloseTo(expected, 3)
  })
})

// ─── Residential: Payback ────────────────────────────────────────────────────

describe('calculateResidentialPayback', () => {
  it('£800 net cost, £130.50/yr → ~6.13 yrs', () => {
    const crm = { netCost: 800, annualBillSaving: 13_050 }  // 13,050p = £130.50
    expect(calculateResidentialPayback(crm)).toBeCloseTo(800 / 130.5, 1)
  })

  it('returns null when there is no bill saving', () => {
    expect(calculateResidentialPayback({ netCost: 1000, annualBillSaving: 0 })).toBeNull()
  })
})

// ─── Grant Eligibility ───────────────────────────────────────────────────────

describe('checkGrantEligibility', () => {
  const baseProperty = { currentEpcRating: 'D', isOffGasGrid: false }

  it('air source heat pump on EPC D → BUS + 0% VAT', () => {
    const crm = { crmType: 'Air source heat pump', category: 'Green Thermal', capexCost: 14_000 }
    const grants = checkGrantEligibility(baseProperty, crm)
    const names = grants.map(g => g.name)
    expect(names).toContain('Boiler Upgrade Scheme (BUS)')
    expect(names).toContain('0% VAT relief')
    expect(grants.find(g => g.name === 'Boiler Upgrade Scheme (BUS)').value).toBe(7500)
  })

  it('heat pump on EPC F → no BUS', () => {
    const crm = { crmType: 'Air source heat pump', category: 'Green Thermal', capexCost: 14_000 }
    const grants = checkGrantEligibility({ ...baseProperty, currentEpcRating: 'F' }, crm)
    expect(grants.map(g => g.name)).not.toContain('Boiler Upgrade Scheme (BUS)')
  })

  it('off-gas-grid property with fabric measure → HUG2', () => {
    const crm = { crmType: 'Loft insulation', category: 'Fabric', capexCost: 300 }
    const grants = checkGrantEligibility({ ...baseProperty, isOffGasGrid: true }, crm)
    expect(grants.map(g => g.name)).toContain('Home Upgrade Grant (HUG2)')
  })

  it('off-gas-grid on-gas (contradiction) — only checks isOffGasGrid flag', () => {
    const crm = { crmType: 'Loft insulation', category: 'Fabric', capexCost: 300 }
    const grants = checkGrantEligibility({ ...baseProperty, isOffGasGrid: false }, crm)
    expect(grants.map(g => g.name)).not.toContain('Home Upgrade Grant (HUG2)')
  })

  it('0% VAT value = 20% of capexCost', () => {
    const crm = { crmType: 'Loft insulation', category: 'Fabric', capexCost: 12_000 }
    const grants = checkGrantEligibility(baseProperty, crm)
    const vat = grants.find(g => g.name === '0% VAT relief')
    expect(vat.value).toBeCloseTo(2_400, 2)
  })

  it('LED lighting → no grants', () => {
    const crm = { crmType: 'LED lighting upgrade', category: 'Electrical', isSolarPV: false, capexCost: 300 }
    expect(checkGrantEligibility(baseProperty, crm)).toHaveLength(0)
  })

  it('solar PV → 0% VAT only', () => {
    const crm = { crmType: 'Rooftop solar PV', category: 'Green Power', isSolarPV: true, capexCost: 6_000 }
    const grants = checkGrantEligibility(baseProperty, crm)
    expect(grants.map(g => g.name)).toContain('0% VAT relief')
    expect(grants.map(g => g.name)).not.toContain('Boiler Upgrade Scheme (BUS)')
  })
})

// ─── Solar PV Yield ──────────────────────────────────────────────────────────

describe('calculateSolarYield', () => {
  it('4kWp south-facing → 3,400 kWh/yr, 1,360 self-consumed, 2,040 exported', () => {
    const { annualKwh, selfConsumptionKwh, exportKwh } = calculateSolarYield(4, 'south')
    expect(annualKwh).toBeCloseTo(3_400, 0)
    expect(selfConsumptionKwh).toBeCloseTo(1_360, 0)
    expect(exportKwh).toBeCloseTo(2_040, 0)
  })

  it('east/west facing → 100 kWh/kWp lower yield', () => {
    const south = calculateSolarYield(4, 'south')
    const east  = calculateSolarYield(4, 'east')
    expect(south.annualKwh - east.annualKwh).toBeCloseTo(400, 0)
  })

  it('self-consumption + export = total generation', () => {
    const { annualKwh, selfConsumptionKwh, exportKwh } = calculateSolarYield(6, 'south')
    expect(selfConsumptionKwh + exportKwh).toBeCloseTo(annualKwh, 5)
  })

  it('zero kWp → zero output', () => {
    const { annualKwh } = calculateSolarYield(0)
    expect(annualKwh).toBe(0)
  })
})

// ─── Site Results (integration) ──────────────────────────────────────────────

describe('calculateSiteResults', () => {
  const site     = { id: 'site-1', includeInPortfolio: true }
  const building = { id: 'bldg-1', siteId: 'site-1' }
  const asset    = { id: 'asset-1', buildingId: 'bldg-1', siteId: 'site-1', annualKwhConsumed: 100_000, efficiencyPct: 0.8, unitRatePkWh: 6 }
  const crm1     = { id: 'crm-1', assetId: 'asset-1', buildingId: 'bldg-1', siteId: 'site-1', include: true,  reductionPctAuto: 0.10, reductionPctManual: null, isFuelSwitch: false, utility: 'gas', persistenceFactor: 8.42, capexCost: 10_000 }
  const crm2     = { id: 'crm-2', assetId: 'asset-1', buildingId: 'bldg-1', siteId: 'site-1', include: false, reductionPctAuto: 0.20, reductionPctManual: null, isFuelSwitch: false, utility: 'gas', persistenceFactor: 25,   capexCost: 20_000 }

  it('excluded CRMs are not counted in totals', () => {
    const result = calculateSiteResults(site, [building], [asset], [crm1, crm2], defaultSettings)
    expect(result.totalCapex).toBe(10_000)
    expect(result.totalGasKwhSaving).toBeCloseTo(10_000, 0)
  })

  it('totalGasKwhSaving matches sum of included CRMs', () => {
    const bothIncluded = [{ ...crm1 }, { ...crm2, include: true }]
    const result = calculateSiteResults(site, [building], [asset], bothIncluded, defaultSettings)
    expect(result.totalGasKwhSaving).toBeCloseTo(30_000, 0)  // 10% + 20% of 100,000
  })

  it('CCT = totalCapex / totalLtCo2', () => {
    const result = calculateSiteResults(site, [building], [asset], [crm1], defaultSettings)
    expect(result.cct).toBeCloseTo(result.totalCapex / result.totalLtCo2, 2)
  })
})
