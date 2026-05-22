# Energy Audit & Decarbonisation Planning Tool — Project Spec

## What We're Building

A web-based energy audit and retrofit decarbonisation planning tool for energy consultants working with residential and commercial/public sector properties. The tool takes a consultant through the full pipeline from site/asset data entry to a client-ready carbon reduction and cost output.

The tool supports two modes:
- **Commercial/Public Sector**: multi-site portfolio, asset-level modelling, Salix funding optimisation
- **Residential**: single property or small portfolio, top-down bill-based modelling, grant eligibility checker

The commercial logic is reverse-engineered and improved from a professional-grade Excel tool (EQUANS ECS Building Carbon Audit Template, BCAT v2) used for Salix PSDS funding applications.

---

## Tech Stack

- **Frontend**: React (single-page app)
- **Styling**: Tailwind CSS
- **State**: React Context + useReducer, persisted to localStorage
- **Hosting**: Vercel (static deploy, no backend required)
- All calculations run client-side in JavaScript

---

## Core Data Model

### Shared

#### Audit
```js
{
  id: string,
  mode: "commercial" | "residential",
  client: Client,
  createdAt: Date,
  settings: AuditSettings
}
```

#### AuditSettings

```js
{
  gasCarbonFactor: number,          // default 0.00018387 tCO2e/kWh
  elecCarbonFactor: number,         // default 0.00019121 tCO2e/kWh
  gasUnitRatePkWh: number,          // pence/kWh
  elecUnitRatePkWh: number,
  // Commercial only:
  salixCarbonPricePer_LTtCO2: number,  // default 95
  likeForLikeReplacementCost: number
}
```

-----

### Commercial Data Model

Data hierarchy: **Client → Sites → Buildings → Assets → CRMs**

#### Site

```js
{
  id: string,
  clientId: string,
  name: string,
  postcode: string,
  degreeDayRegion: string,
  includeInPortfolio: boolean,
  baselineGasKwh: number,
  baselineElecKwh: number
}
```

#### Building

```js
{
  id: string,
  siteId: string,
  name: string,
  floorAreaM2: number
}
```

#### Asset

```js
{
  id: string,
  buildingId: string,
  assetRef: string,            // e.g. "#25"
  description: string,         // e.g. "Boiler_Hoval SR Plus 400"
  seu: string,                 // "Space Heating" | "Hot Water Services" | "Space Cooling" | "Lighting" | "Ventilation" | "Other"
  energySource: string,        // "Natural Gas" | "Electricity" | "Oil" | "LPG"
  meterRef: string,
  unitRatePkWh: number,
  ratedKw: number,
  efficiencyPct: number,       // e.g. 0.8
  qty: number,
  operatingPattern: string,    // "24/7 Operation" | "Office Hours 5 day" | "Office Hours 7 day" | "Custom"
  operatingHoursPerYear: number,
  loadFactor: number,          // 0–1
  annualKwhConsumed: number    // calculated
}
```

#### CRM (Commercial)

```js
{
  id: string,
  assetId: string,
  buildingId: string,
  siteId: string,
  include: boolean,
  scenario: string,
  crmCategory: string,         // "Energy_Efficiency" | "Green_Thermal" | "Green_Power" | "Behaviour_Change"
  crmSubCategory: string,
  crmType: string,
  description: string,
  assumptions: string,
  implementationYear: number,
  reductionPctAuto: number | null,
  reductionPctManual: number | null,
  annualKwhReduction: number,
  isFuelSwitch: boolean,
  existingEfficiency: number,
  proposedSCOP: number | null,
  proposedSCOPManual: number | null,
  associatedElecMpan: string,
  elecUnitRatePkWh: number,
  annualKwhIncreaseElec: number,
  isSolarPV: boolean,
  solarKwp: number | null,
  annualKwhGeneration: number | null,
  capexCost: number,
  persistenceFactor: number
}
```

-----

### Residential Data Model

#### Property

```js
{
  id: string,
  auditId: string,
  address: string,
  postcode: string,
  propertyType: string,        // "Detached" | "Semi-detached" | "Terraced" | "Flat" | "Bungalow"
  constructionEra: string,     // "Pre-1919" | "1919-1944" | "1945-1964" | "1965-1980" | "1981-1990" | "1991-2002" | "Post-2002"
  floorAreaM2: number,
  numBedrooms: number,
  currentEpcRating: string,    // "A"–"G"
  currentEpcScore: number,
  isOffGasGrid: boolean,
  currentHeatingFuel: string,  // "Natural Gas" | "Oil" | "LPG" | "Electric" | "Solid Fuel"
  baselineGasKwh: number,
  baselineElecKwh: number,
  gasUnitRatePkWh: number,
  elecUnitRatePkWh: number,
  boilerType: string,          // "Combi" | "System" | "Regular"
  boilerAgeYears: number,
  boilerEfficiencyPct: number, // default 0.80
  currentHeatEmitters: string, // "Radiators (LTHW)" | "Underfloor heating" | "Mixed"
  wallType: string,
  wallUValue: number,
  roofInsulationMm: number,
  roofUValue: number,
  floorUValue: number,
  glazingType: string,
  glazingUValue: number
}
```

#### CRM (Residential)

```js
{
  id: string,
  propertyId: string,
  include: boolean,
  crmType: string,
  description: string,
  capexCost: number,
  grantAvailable: number,
  netCost: number,
  annualKwhReduction: number,
  annualBillSaving: number,
  lifetimeTco2: number,
  persistenceFactor: number,
  simplePaybackYears: number,
  isFuelSwitch: boolean,
  proposedSCOP: number | null,
  elecKwhIncrease: number
}
```

-----

## Calculation Engine

All maths lives in `/src/engine/calculations.js` — pure functions, no React, no side effects.

### Asset Annual Energy (Commercial)

```js
// FLEQ = Full Load Equivalent Hours
FLEQ_hours = operatingHoursPerYear × loadFactor
annualKwhConsumed = (ratedKw × qty × FLEQ_hours) / efficiencyPct
// Divide by efficiency to get INPUT fuel energy (e.g. gas in to a boiler)
```

### Annual kWh Saving

```js
reductionPct = reductionPctManual ?? reductionPctAuto
annualKwhReduction = asset.annualKwhConsumed × reductionPct
// For residential: annualKwhReduction = property.baselineGasKwh × reductionPct
```

### Fuel Switch — ASHP/GSHP replacing gas

```js
// Gas saving
gasKwhReduction = baselineKwh × reductionPct   // e.g. 0.8 for 80% replacement

// Heat the ASHP must deliver (accounting for existing boiler efficiency)
heatDeliveredKwh = gasKwhReduction × existingEfficiency

// Electricity required
elecKwhIncrease = heatDeliveredKwh / proposedSCOP

// Net annual bill impact
annualBillSaving = (gasKwhReduction × gasUnitRatePkWh / 100)
                 - (elecKwhIncrease × elecUnitRatePkWh / 100)
```

### Lifetime tCO₂e

```js
// Gas saving measure
lifetimeTco2_direct = annualKwhReduction × persistenceFactor × GAS_CARBON_FACTOR

// Electricity saving measure
lifetimeTco2_indirect = annualKwhSaving × persistenceFactor × ELEC_CARBON_FACTOR

// Fuel switch (net)
lifetimeTco2 = (annualKwhReduction × GAS_CARBON_FACTOR
               - elecKwhIncrease × ELEC_CARBON_FACTOR)
               × persistenceFactor
```

### Carbon Cost Threshold (Commercial)

```js
cct = capexCost / lifetimeTco2    // £ per lifetime tCO₂e (lower = more fundable)
```

### Salix Funding (Commercial)

```js
fundableValue = lifetimeTco2 × salixCarbonPricePer_LTtCO2
minContribution = totalCapex × 0.12   // Salix 12% like-for-like rule
contribution = Math.max(likeForLikeReplacementCost, minContribution)
fundingShortfall = totalCapex - fundableValue - contribution
```

### Solar PV Yield

```js
// Commercial: from SolarModel or manual input
// Residential:
annualKwhGeneration = installedKwp × 850    // UK average; adjust ±100 for orientation
selfConsumptionKwh = annualKwhGeneration × 0.40
exportKwh = annualKwhGeneration - selfConsumptionKwh
annualBillSaving = (selfConsumptionKwh × elecUnitRatePkWh / 100)
                 + (exportKwh × SEG_RATE / 100)   // SEG ~15p/kWh typical
```

-----

## Constants (constants.js)

```js
export const CARBON_FACTORS = {
  gas:         0.00018387,   // tCO2e/kWh — DESNZ 2023
  electricity: 0.00019121    // tCO2e/kWh — grid average Scope 2
}

export const SALIX_PERSISTENCE_FACTORS = {
  loft_insulation:  27,   cavity_wall:      27,
  roof_insulation:  27,   glazing:          27,
  ashp:             20,   gshp:             20,
  solar_thermal:    20,   solar_pv:         22.5,
  led:              25,   bems:             8.42,
  time_switches:    9.7,  vsds:             9.7,
  thermal_stores:   9.7,  behaviour_change: 5
}

export const OPERATING_PATTERNS = {
  "24/7 Operation":     8736,
  "Office Hours 5 day": 3120,
  "Office Hours 7 day": 4368,
  "Evening & Weekend":  2600
}

export const COMMERCIAL_SCOP = {
  lthw_55: 2.4,   // existing radiators — most common public sector
  lthw_45: 2.7,   // upgraded radiators
  lthw_35: 3.2,   // underfloor heating
  dhw:     2.3,
  gshp:    3.2
}

export const RESIDENTIAL_SCOP = {
  ashp_radiators_lthw55: 2.5,
  ashp_radiators_lthw45: 2.8,
  ashp_underfloor_lthw35: 3.2,
  ashp_dhw: 2.3,
  gshp_radiators: 3.2,
  gshp_underfloor: 3.8
}

export const RESIDENTIAL_REDUCTION_BENCHMARKS = {
  loft_insulation_full:           0.15,
  loft_insulation_top_up:         0.05,
  cavity_wall_insulation:         0.15,
  solid_wall_external:            0.25,
  solid_wall_internal:            0.20,
  floor_insulation:               0.08,
  double_glazing_from_single:     0.10,
  triple_glazing_from_double:     0.03,
  draught_proofing:               0.03,
  smart_thermostat:               0.10,
  hot_water_cylinder_insulation:  0.05,
  led_lighting:                   0.50   // of lighting sub-load, not total
}

export const SALIX_MIN_CONTRIBUTION_PCT = 0.12
export const SEG_RATE_PKWH = 15   // Smart Export Guarantee, pence/kWh typical
```

-----

## CRM Libraries

### Commercial CRM Library

```js
export const COMMERCIAL_CRM_LIBRARY = [
  { type: "Loft insulation",                     category: "Energy_Efficiency", subCategory: "Fabric_Improvements",  persistence: 27,   utility: "gas",  defaultReductionPct: null },
  { type: "Cavity wall insulation",              category: "Energy_Efficiency", subCategory: "Fabric_Improvements",  persistence: 27,   utility: "gas",  defaultReductionPct: null },
  { type: "Dry wall lining",                     category: "Energy_Efficiency", subCategory: "Fabric_Improvements",  persistence: 27,   utility: "gas",  defaultReductionPct: null },
  { type: "Roof insulation",                     category: "Energy_Efficiency", subCategory: "Fabric_Improvements",  persistence: 27,   utility: "gas",  defaultReductionPct: null },
  { type: "Double glazing",                      category: "Energy_Efficiency", subCategory: "Fabric_Improvements",  persistence: 27,   utility: "gas",  defaultReductionPct: null },
  { type: "BEMS upgrade",                        category: "Energy_Efficiency", subCategory: "Controls",             persistence: 8.42, utility: "gas",  defaultReductionPct: 0.35 },
  { type: "Plug-in timers / scheduling",         category: "Energy_Efficiency", subCategory: "Controls",             persistence: 9.7,  utility: "elec", defaultReductionPct: 0.15 },
  { type: "Variable speed drives",               category: "Energy_Efficiency", subCategory: "Controls",             persistence: 9.7,  utility: "elec", defaultReductionPct: 0.03 },
  { type: "Thermal stores",                      category: "Energy_Efficiency", subCategory: "Controls",             persistence: 9.7,  utility: "gas",  defaultReductionPct: 0.03 },
  { type: "Ventilation upgrade",                 category: "Energy_Efficiency", subCategory: "Controls",             persistence: 9.7,  utility: "elec", defaultReductionPct: 0.09 },
  { type: "LED upgrade",                         category: "Energy_Efficiency", subCategory: "Electrical_Systems",   persistence: 25,   utility: "elec", defaultReductionPct: 0.50 },
  { type: "High efficiency fans",                category: "Energy_Efficiency", subCategory: "Electrical_Systems",   persistence: 9.7,  utility: "elec", defaultReductionPct: 0.30 },
  { type: "ASHP (100% gas replacement)",         category: "Green_Thermal",     subCategory: "Heat_Pumps",           persistence: 20,   utility: "gas",  defaultReductionPct: 1.0,  isFuelSwitch: true },
  { type: "ASHP (80% gas replacement)",          category: "Green_Thermal",     subCategory: "Heat_Pumps",           persistence: 20,   utility: "gas",  defaultReductionPct: 0.8,  isFuelSwitch: true },
  { type: "GSHP (100% gas replacement)",         category: "Green_Thermal",     subCategory: "Heat_Pumps",           persistence: 20,   utility: "gas",  defaultReductionPct: 1.0,  isFuelSwitch: true },
  { type: "Solar thermal",                       category: "Green_Thermal",     subCategory: "Solar_Thermal",        persistence: 20,   utility: "gas",  defaultReductionPct: null },
  { type: "Rooftop solar PV",                    category: "Green_Power",       subCategory: "Solar_PV",             persistence: 22.5, utility: "elec", isSolarPV: true },
  { type: "Behaviour change programme",          category: "Behaviour_Change",  subCategory: "Behaviour_Change",     persistence: 5,    utility: "gas",  defaultReductionPct: 0.05 },
]
```

### Residential CRM Library

```js
export const RESIDENTIAL_CRM_LIBRARY = [
  { type: "Loft insulation (0–270mm)",           category: "Fabric",        persistence: 42,   benchmarkCost: 300,   benchmarkReductionPct: 0.15 },
  { type: "Loft insulation top-up",              category: "Fabric",        persistence: 42,   benchmarkCost: 200,   benchmarkReductionPct: 0.05 },
  { type: "Cavity wall insulation",              category: "Fabric",        persistence: 42,   benchmarkCost: 800,   benchmarkReductionPct: 0.15 },
  { type: "External solid wall insulation",      category: "Fabric",        persistence: 42,   benchmarkCost: 12000, benchmarkReductionPct: 0.25 },
  { type: "Internal solid wall insulation",      category: "Fabric",        persistence: 42,   benchmarkCost: 8000,  benchmarkReductionPct: 0.20 },
  { type: "Floor insulation",                    category: "Fabric",        persistence: 42,   benchmarkCost: 1500,  benchmarkReductionPct: 0.08 },
  { type: "Double glazing (from single)",        category: "Fabric",        persistence: 25,   benchmarkCost: 5000,  benchmarkReductionPct: 0.10 },
  { type: "Triple glazing (from double)",        category: "Fabric",        persistence: 25,   benchmarkCost: 8000,  benchmarkReductionPct: 0.03 },
  { type: "Draught proofing",                    category: "Fabric",        persistence: 10,   benchmarkCost: 300,   benchmarkReductionPct: 0.03 },
  { type: "Air source heat pump",                category: "Green Thermal", persistence: 20,   benchmarkCost: 14000, isFuelSwitch: true, defaultSCOP: 2.5 },
  { type: "Ground source heat pump",             category: "Green Thermal", persistence: 20,   benchmarkCost: 24000, isFuelSwitch: true, defaultSCOP: 3.2 },
  { type: "Solar thermal (hot water)",           category: "Green Thermal", persistence: 20,   benchmarkCost: 5000,  benchmarkReductionPct: 0.50 },
  { type: "Hot water cylinder insulation",       category: "Green Thermal", persistence: 10,   benchmarkCost: 50,    benchmarkReductionPct: 0.05 },
  { type: "Smart thermostat / TRVs",             category: "Controls",      persistence: 10,   benchmarkCost: 400,   benchmarkReductionPct: 0.10 },
  { type: "LED lighting upgrade",                category: "Electrical",    persistence: 15,   benchmarkCost: 300,   benchmarkReductionPct: 0.50 },
  { type: "Rooftop solar PV",                    category: "Green Power",   persistence: 25,   benchmarkCost: 6000,  isSolarPV: true },
  { type: "Battery storage",                     category: "Green Power",   persistence: 10,   benchmarkCost: 5000,  note: "Increases self-consumption — pair with solar PV" },
]
```

-----

## Grant Eligibility Logic (Residential)

Auto-flag relevant grants based on property and CRM:

```js
function checkGrantEligibility(property, crm) {
  const grants = []
  const isHeatPump = crm.crmType.toLowerCase().includes("heat pump")
  const isFabric = crm.category === "Fabric"
  const isSolar = crm.isSolarPV

  // Boiler Upgrade Scheme (BUS)
  if (isHeatPump && !["F","G"].includes(property.currentEpcRating)) {
    grants.push({ name: "Boiler Upgrade Scheme (BUS)", value: 7500 })
  }

  // Home Upgrade Grant (HUG2) — off gas grid
  if (property.isOffGasGrid && (isFabric || isHeatPump)) {
    grants.push({ name: "Home Upgrade Grant (HUG2)", value: null, note: "Contact local authority — value varies" })
  }

  // 0% VAT
  if (isHeatPump || isFabric || isSolar) {
    grants.push({ name: "0% VAT relief", value: crm.capexCost * 0.20, note: "Saving vs 20% standard rate" })
  }

  return grants
}
```

-----

## App Structure

### Pages / Steps

**1. Dashboard**

- List of audits with mode badge (Commercial / Residential)
- Key metrics per audit
- New Audit button with mode selector

**2. Audit Setup**

- Client name + contact
- Mode: Commercial or Residential
- Commercial: add sites (name, postcode, degree day region, baseline kWh)
- Residential: add properties (address, property type, EPC, baseline kWh from bills)

**3. Asset Register (Commercial only)**

- Per building: add assets with kW rating, operating hours, load factor
- Auto-calculates annualKwhConsumed
- Inline editing table

**4. CRM Builder**

- Commercial: per asset, select measure from library, set % reduction or accept default, toggle fuel switch
- Residential: per property, select measure from library, accept benchmark cost + reduction or override
- Include/Exclude toggle per CRM
- Grant eligibility panel (residential)

**5. Results Dashboard**

- Commercial: site-level + portfolio rollup, CCT, Salix fundable value, funding shortfall
- Residential: property-level bill saving, payback, grant summary, recommended priority order
- Live recalculation when toggles change
- Charts: CAPEX by measure type, tCO₂e by measure type

**6. Report Export**

- PDF summary (client-facing)
- CSV data export
- JSON export (for re-import)

-----

## Calculation Engine API (calculations.js)

```js
// Commercial
calculateAssetKwh(asset)                              // → number
calculateCRMSavings(crm, asset)                       // → { gasKwhSaving, elecKwhSaving, elecKwhIncrease }
calculateLtCo2(crm, asset, settings)                  // → { directTco2, indirectTco2 }
calculateAnnualCostSaving(crm, asset, settings)       // → number
calculateSiteResults(site, buildings, assets, crms, settings)     // → SiteResults
calculatePortfolioResults(sites, allResults, settings)            // → PortfolioResults
calculateCCT(capex, ltCo2)                            // → number
calculateSalixFunding(ltCo2, salixPrice, totalCapex, likeForLike) // → FundingResult

// Residential
calculateResidentialCRMSavings(crm, property)         // → { kwhReduction, elecIncrease, billSaving }
calculateResidentialLtCo2(crm, property, settings)    // → number
calculateResidentialPayback(crm)                      // → number
calculatePropertyResults(property, crms, settings)    // → PropertyResults
checkGrantEligibility(property, crm)                  // → Grant[]

// Shared
calculateSolarYield(kwp, orientation)                 // → { annualKwh, selfConsumption, export }
```

-----

## State Shape

```js
{
  currentAuditId: string | null,
  audits: {
    [auditId]: {
      mode: "commercial" | "residential",
      client: Client,
      settings: AuditSettings,
      // Commercial
      sites: Site[],
      buildings: Building[],
      assets: Asset[],
      // Residential
      properties: Property[],
      // Shared
      crms: CRM[],
      createdAt: Date,
      updatedAt: Date
    }
  }
}
```

Persist full state to localStorage on every change. Load and rehydrate on mount.

-----

## Build Phases

### Phase 1 — Calculation Engine (start here)

- Implement `src/engine/calculations.js` and `src/engine/constants.js`
- Write unit tests (Vitest) against known reference values:
  - Commercial: Hoval SR Plus 400 boiler at 1200kW, 80% eff, Office Hours 5 day, load factor 0.2 → 935,999 kWh/yr gas
  - ASHP 80% replacement on above → 486,081 kWh gas saving, ~167,342 kWh elec increase (at sCOP 2.32)
  - LTtCO₂e on above: 486,081 × 20 × 0.00018387 = ~1,788 tCO₂e direct
  - Residential: 15,000 kWh gas baseline, loft insulation 15% → 2,250 kWh/yr saving, £130/yr at 5.8p
- Goal: all tests passing before any UI work

### Phase 2 — Core UI Shell

- React app with React Router
- Dashboard + Audit Setup (both modes)
- Commercial: Site entry + Asset Register
- Residential: Property entry form

### Phase 3 — CRM Builder + Results

- CRM Builder (commercial + residential variants)
- Results Dashboard with live recalculation
- Grant eligibility panel

### Phase 4 — Polish + Export

- PDF report export
- CSV export
- Charts (recharts)
- Mobile-responsive layout

-----

## Important Rules for Claude Code

- Always run calculations through `calculations.js`, never inline in React components
- All monetary values stored in pence (integer) internally, displayed as £ with toLocaleString
- All kWh values are annual unless prefixed "lifetime" or "LT"
- "Direct" carbon = Scope 1 (gas combustion). "Indirect" = Scope 2 (electricity, grid)
- Salix persistence factors are measure lifetimes in years — not discount factors
- For ASHP fuel switch: the existing boiler efficiency must be applied before dividing by sCOP (you're replacing the HEAT DELIVERED, not the gas consumed)
- Excluded CRMs must be excluded from ALL rollup totals, not just display
- Fabric measures reduce HEATING DEMAND — model as % reduction on space heating asset kWh
- Benchmark costs and reduction percentages are defaults only — consultants always override with real data
