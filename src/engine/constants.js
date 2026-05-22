export const CARBON_FACTORS = {
  gas:         0.00018387,   // tCO2e/kWh — DESNZ 2023
  electricity: 0.00019121,   // tCO2e/kWh — grid average Scope 2
}

export const SALIX_PERSISTENCE_FACTORS = {
  loft_insulation:  27,
  cavity_wall:      27,
  roof_insulation:  27,
  glazing:          27,
  ashp:             20,
  gshp:             20,
  solar_thermal:    20,
  solar_pv:         22.5,
  led:              25,
  bems:             8.42,
  time_switches:    9.7,
  vsds:             9.7,
  thermal_stores:   9.7,
  behaviour_change: 5,
}

export const OPERATING_PATTERNS = {
  '24/7 Operation':     8736,
  'Office Hours 5 day': 3120,
  'Office Hours 7 day': 4368,
  'Evening & Weekend':  2600,
}

export const COMMERCIAL_SCOP = {
  lthw_55: 2.4,
  lthw_45: 2.7,
  lthw_35: 3.2,
  dhw:     2.3,
  gshp:    3.2,
}

export const RESIDENTIAL_SCOP = {
  ashp_radiators_lthw55:  2.5,
  ashp_radiators_lthw45:  2.8,
  ashp_underfloor_lthw35: 3.2,
  ashp_dhw:               2.3,
  gshp_radiators:         3.2,
  gshp_underfloor:        3.8,
}

export const RESIDENTIAL_REDUCTION_BENCHMARKS = {
  loft_insulation_full:          0.15,
  loft_insulation_top_up:        0.05,
  cavity_wall_insulation:        0.15,
  solid_wall_external:           0.25,
  solid_wall_internal:           0.20,
  floor_insulation:              0.08,
  double_glazing_from_single:    0.10,
  triple_glazing_from_double:    0.03,
  draught_proofing:              0.03,
  smart_thermostat:              0.10,
  hot_water_cylinder_insulation: 0.05,
  led_lighting:                  0.50,
}

export const SALIX_MIN_CONTRIBUTION_PCT = 0.12
export const SEG_RATE_PKWH = 15   // Smart Export Guarantee, pence/kWh typical
export const SOLAR_UK_YIELD_KWH_PER_KWP = 850
export const SOLAR_SELF_CONSUMPTION_RATE = 0.40
export const DEFAULT_SALIX_CARBON_PRICE = 95
export const DEFAULT_GAS_BOILER_EFFICIENCY = 0.80

export const COMMERCIAL_CRM_LIBRARY = [
  { type: 'Loft insulation',               category: 'Energy_Efficiency', subCategory: 'Fabric_Improvements',  persistence: 27,   utility: 'gas',  defaultReductionPct: null },
  { type: 'Cavity wall insulation',         category: 'Energy_Efficiency', subCategory: 'Fabric_Improvements',  persistence: 27,   utility: 'gas',  defaultReductionPct: null },
  { type: 'Dry wall lining',               category: 'Energy_Efficiency', subCategory: 'Fabric_Improvements',  persistence: 27,   utility: 'gas',  defaultReductionPct: null },
  { type: 'Roof insulation',               category: 'Energy_Efficiency', subCategory: 'Fabric_Improvements',  persistence: 27,   utility: 'gas',  defaultReductionPct: null },
  { type: 'Double glazing',                category: 'Energy_Efficiency', subCategory: 'Fabric_Improvements',  persistence: 27,   utility: 'gas',  defaultReductionPct: null },
  { type: 'BEMS upgrade',                  category: 'Energy_Efficiency', subCategory: 'Controls',             persistence: 8.42, utility: 'gas',  defaultReductionPct: 0.35 },
  { type: 'Plug-in timers / scheduling',   category: 'Energy_Efficiency', subCategory: 'Controls',             persistence: 9.7,  utility: 'elec', defaultReductionPct: 0.15 },
  { type: 'Variable speed drives',         category: 'Energy_Efficiency', subCategory: 'Controls',             persistence: 9.7,  utility: 'elec', defaultReductionPct: 0.03 },
  { type: 'Thermal stores',               category: 'Energy_Efficiency', subCategory: 'Controls',             persistence: 9.7,  utility: 'gas',  defaultReductionPct: 0.03 },
  { type: 'Ventilation upgrade',           category: 'Energy_Efficiency', subCategory: 'Controls',             persistence: 9.7,  utility: 'elec', defaultReductionPct: 0.09 },
  { type: 'LED upgrade',                   category: 'Energy_Efficiency', subCategory: 'Electrical_Systems',   persistence: 25,   utility: 'elec', defaultReductionPct: 0.50 },
  { type: 'High efficiency fans',          category: 'Energy_Efficiency', subCategory: 'Electrical_Systems',   persistence: 9.7,  utility: 'elec', defaultReductionPct: 0.30 },
  { type: 'ASHP (100% gas replacement)',   category: 'Green_Thermal',     subCategory: 'Heat_Pumps',           persistence: 20,   utility: 'gas',  defaultReductionPct: 1.0,  isFuelSwitch: true },
  { type: 'ASHP (80% gas replacement)',    category: 'Green_Thermal',     subCategory: 'Heat_Pumps',           persistence: 20,   utility: 'gas',  defaultReductionPct: 0.8,  isFuelSwitch: true },
  { type: 'GSHP (100% gas replacement)',   category: 'Green_Thermal',     subCategory: 'Heat_Pumps',           persistence: 20,   utility: 'gas',  defaultReductionPct: 1.0,  isFuelSwitch: true },
  { type: 'Solar thermal',                 category: 'Green_Thermal',     subCategory: 'Solar_Thermal',        persistence: 20,   utility: 'gas',  defaultReductionPct: null },
  { type: 'Rooftop solar PV',              category: 'Green_Power',       subCategory: 'Solar_PV',             persistence: 22.5, utility: 'elec', isSolarPV: true },
  { type: 'Behaviour change programme',    category: 'Behaviour_Change',  subCategory: 'Behaviour_Change',     persistence: 5,    utility: 'gas',  defaultReductionPct: 0.05 },
]

export const RESIDENTIAL_CRM_LIBRARY = [
  { type: 'Loft insulation (0–270mm)',      category: 'Fabric',        persistence: 42,  benchmarkCost: 300,   benchmarkReductionPct: 0.15 },
  { type: 'Loft insulation top-up',         category: 'Fabric',        persistence: 42,  benchmarkCost: 200,   benchmarkReductionPct: 0.05 },
  { type: 'Cavity wall insulation',         category: 'Fabric',        persistence: 42,  benchmarkCost: 800,   benchmarkReductionPct: 0.15 },
  { type: 'External solid wall insulation', category: 'Fabric',        persistence: 42,  benchmarkCost: 12000, benchmarkReductionPct: 0.25 },
  { type: 'Internal solid wall insulation', category: 'Fabric',        persistence: 42,  benchmarkCost: 8000,  benchmarkReductionPct: 0.20 },
  { type: 'Floor insulation',               category: 'Fabric',        persistence: 42,  benchmarkCost: 1500,  benchmarkReductionPct: 0.08 },
  { type: 'Double glazing (from single)',   category: 'Fabric',        persistence: 25,  benchmarkCost: 5000,  benchmarkReductionPct: 0.10 },
  { type: 'Triple glazing (from double)',   category: 'Fabric',        persistence: 25,  benchmarkCost: 8000,  benchmarkReductionPct: 0.03 },
  { type: 'Draught proofing',               category: 'Fabric',        persistence: 10,  benchmarkCost: 300,   benchmarkReductionPct: 0.03 },
  { type: 'Air source heat pump',           category: 'Green Thermal', persistence: 20,  benchmarkCost: 14000, isFuelSwitch: true, defaultSCOP: 2.5 },
  { type: 'Ground source heat pump',        category: 'Green Thermal', persistence: 20,  benchmarkCost: 24000, isFuelSwitch: true, defaultSCOP: 3.2 },
  { type: 'Solar thermal (hot water)',      category: 'Green Thermal', persistence: 20,  benchmarkCost: 5000,  benchmarkReductionPct: 0.50 },
  { type: 'Hot water cylinder insulation',  category: 'Green Thermal', persistence: 10,  benchmarkCost: 50,    benchmarkReductionPct: 0.05 },
  { type: 'Smart thermostat / TRVs',        category: 'Controls',      persistence: 10,  benchmarkCost: 400,   benchmarkReductionPct: 0.10 },
  { type: 'LED lighting upgrade',           category: 'Electrical',    persistence: 15,  benchmarkCost: 300,   benchmarkReductionPct: 0.50 },
  { type: 'Rooftop solar PV',               category: 'Green Power',   persistence: 25,  benchmarkCost: 6000,  isSolarPV: true },
  { type: 'Battery storage',                category: 'Green Power',   persistence: 10,  benchmarkCost: 5000,  note: 'Increases self-consumption — pair with solar PV' },
]
