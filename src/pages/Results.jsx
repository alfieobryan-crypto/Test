import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useAudit } from '../context/AuditContext.jsx'
import {
  calculateCRMSavings, calculateNetLtCo2, calculateAnnualCostSaving, calculateCCT,
  calculateSiteResults, calculatePortfolioResults, calculateSalixFunding,
  calculateResidentialCRMSavings, calculateResidentialLtCo2, checkGrantEligibility,
  calculatePropertyResults,
} from '../engine/calculations.js'
import Layout from '../components/Layout.jsx'
import { exportCSV, printReport } from '../utils/export.js'

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtGbp    = n  => `£${Math.round(n).toLocaleString('en-GB')}`
const fmtPounds = p  => `£${Math.round(p / 100).toLocaleString('en-GB')}`
const fmtKwh    = n  => `${Math.round(n).toLocaleString('en-GB')} kWh`
const fmtTco2   = n  => `${n.toFixed(1)} tCO₂e`
const fmtCct    = n  => n == null || !isFinite(n) ? '—' : `£${n.toFixed(0)}/t`
const fmtYrs    = n  => n == null || !isFinite(n) ? '—' : `${n.toFixed(1)} yrs`

const CAT_DISPLAY = {
  Energy_Efficiency: 'Energy Efficiency',
  Green_Thermal:     'Green Thermal',
  Green_Power:       'Green Power',
  Behaviour_Change:  'Behaviour Change',
  Fabric:            'Fabric',
  'Green Thermal':   'Green Thermal',
  'Green Power':     'Green Power',
  Controls:          'Controls',
  Electrical:        'Electrical',
}
const CAT_FILL = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#f97316','#06b6d4','#84cc16']

// ─── Shared stat card ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, colour = 'blue' }) {
  const ring = { blue: 'border-blue-200 bg-blue-50', green: 'border-emerald-200 bg-emerald-50',
                 amber: 'border-amber-200 bg-amber-50', purple: 'border-purple-200 bg-purple-50' }
  const text = { blue: 'text-blue-700', green: 'text-emerald-700', amber: 'text-amber-700', purple: 'text-purple-700' }
  return (
    <div className={`rounded-xl border p-4 ${ring[colour]}`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text[colour]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Simple recharts bar chart ────────────────────────────────────────────────

function CategoryBarChart({ data, dataKey, label, formatter }) {
  if (!data || data.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{label}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={n => formatter ? formatter(n) : n} />
          <Tooltip formatter={(v) => formatter ? formatter(v) : v} />
          <Bar dataKey={dataKey} radius={[4,4,0,0]}>
            {data.map((_, i) => <Cell key={i} fill={CAT_FILL[i % CAT_FILL.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function HorizontalBarChart({ data, label }) {
  if (!data || data.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{label}</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `£${Math.round(v)}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
          <Tooltip formatter={v => [`£${Math.round(v)}/yr`, 'Annual saving']} />
          <Bar dataKey="saving" radius={[0,4,4,0]}>
            {data.map((_, i) => <Cell key={i} fill={CAT_FILL[i % CAT_FILL.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Commercial Results ───────────────────────────────────────────────────────

function CommercialResults({ audit, id }) {
  const navigate = useNavigate()
  const s = audit.settings

  const siteResults = useMemo(() =>
    audit.sites.map(site => calculateSiteResults(site, audit.buildings, audit.assets, audit.crms, s)),
    [audit]
  )

  const portfolio = useMemo(() =>
    calculatePortfolioResults(audit.sites, siteResults, s),
    [audit.sites, siteResults, s]
  )

  const salix = useMemo(() =>
    calculateSalixFunding(
      portfolio.totalLtCo2,
      s.salixCarbonPricePer_LTtCO2,
      portfolio.totalCapex,
      s.likeForLikeReplacementCost
    ),
    [portfolio, s]
  )

  const portfolioCCT = calculateCCT(portfolio.totalCapex, portfolio.totalLtCo2)

  // Category breakdown for charts
  const categoryData = useMemo(() => {
    const map = {}
    for (const crm of audit.crms.filter(c => c.include)) {
      const asset = audit.assets.find(a => a.id === crm.assetId)
      if (!asset) continue
      const cat   = CAT_DISPLAY[crm.crmCategory] || crm.crmCategory || 'Other'
      const ltCo2 = calculateNetLtCo2(crm, asset, s)
      if (!map[cat]) map[cat] = { category: cat, capex: 0, ltCo2: 0 }
      map[cat].capex  += crm.capexCost || 0
      map[cat].ltCo2  += ltCo2
    }
    return Object.values(map).sort((a,b) => b.capex - a.capex)
  }, [audit.crms, audit.assets, s])

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard label="Total CapEx" value={fmtGbp(portfolio.totalCapex)} colour="blue" />
        <StatCard label="Net LTtCO₂e" value={fmtTco2(portfolio.totalLtCo2)} colour="green" />
        <StatCard label="Annual Cost Saving" value={fmtPounds(portfolio.annualCostSavingPence)} sub="/yr" colour="amber" />
        <StatCard label="Portfolio CCT" value={fmtCct(portfolioCCT)} sub="lower = more fundable" colour="purple" />
      </div>

      {/* Salix funding */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Salix Funding (PSDS)</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Salix fundable value</p>
            <p className="text-xl font-bold text-blue-700">{fmtGbp(salix.fundableValue)}</p>
            <p className="text-xs text-gray-400 mt-1">@ £{s.salixCarbonPricePer_LTtCO2}/LTtCO₂e</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Your contribution</p>
            <p className="text-xl font-bold text-gray-800">{fmtGbp(salix.contribution)}</p>
            <p className="text-xs text-gray-400 mt-1">max(like-for-like, 12% capex)</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${salix.fundingShortfall <= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className="text-xs text-gray-500 mb-1">Funding shortfall</p>
            <p className={`text-xl font-bold ${salix.fundingShortfall <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {salix.fundingShortfall <= 0 ? '✓ Fully funded' : fmtGbp(salix.fundingShortfall)}
            </p>
            <p className="text-xs text-gray-400 mt-1">capex − funded − contribution</p>
          </div>
        </div>
      </div>

      {/* Site breakdown table */}
      {audit.sites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Site Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Site</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">CapEx</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Gas Saving</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">LTtCO₂e</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Annual Saving</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">CCT</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Salix Fundable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audit.sites.map((site, i) => {
                  const r = siteResults[i]
                  const siteSalix = calculateSalixFunding(r.totalLtCo2, s.salixCarbonPricePer_LTtCO2, r.totalCapex, 0)
                  return (
                    <tr key={site.id} className={`hover:bg-gray-50 ${!site.includeInPortfolio ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        {site.name}
                        {!site.includeInPortfolio && <span className="ml-2 text-xs text-amber-600">(excluded)</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtGbp(r.totalCapex)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtKwh(r.totalGasKwhSaving)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-medium">{fmtTco2(r.totalLtCo2)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtPounds(r.annualCostSavingPence)}/yr</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtCct(r.cct)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{fmtGbp(siteSalix.fundableValue)}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-3 py-2 text-gray-900">Portfolio Total</td>
                  <td className="px-3 py-2 text-right">{fmtGbp(portfolio.totalCapex)}</td>
                  <td className="px-3 py-2 text-right">{fmtKwh(portfolio.totalGasKwhSaving)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmtTco2(portfolio.totalLtCo2)}</td>
                  <td className="px-3 py-2 text-right">{fmtPounds(portfolio.annualCostSavingPence)}/yr</td>
                  <td className="px-3 py-2 text-right">{fmtCct(portfolioCCT)}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{fmtGbp(salix.fundableValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
          <CategoryBarChart
            data={categoryData} dataKey="capex" label="CapEx by Measure Category (£)"
            formatter={v => `£${Math.round(v).toLocaleString()}`}
          />
          <CategoryBarChart
            data={categoryData} dataKey="ltCo2" label="LTtCO₂e by Measure Category"
            formatter={v => `${v.toFixed(1)} t`}
          />
        </div>
      )}

      {/* CRM summary table */}
      {audit.crms.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">All Measures</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Measure</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Asset</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">CapEx</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Gas Saving</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">LTtCO₂e</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">CCT</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Year</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audit.crms.map(crm => {
                  const asset = audit.assets.find(a => a.id === crm.assetId)
                  if (!asset) return null
                  const savings = calculateCRMSavings(crm, asset)
                  const ltCo2   = calculateNetLtCo2(crm, asset, s)
                  const cct     = calculateCCT(crm.capexCost, ltCo2)
                  return (
                    <tr key={crm.id} className={`hover:bg-gray-50 ${!crm.include ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2 text-gray-900 max-w-48 truncate">{crm.description || crm.crmType}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs max-w-36 truncate">{asset.description}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtGbp(crm.capexCost)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtKwh(savings.gasKwhSaving)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-medium">{fmtTco2(ltCo2)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtCct(cct)}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{crm.implementationYear}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${crm.include ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {crm.include ? 'Included' : 'Excluded'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Residential Results ──────────────────────────────────────────────────────

function ResidentialResults({ audit }) {
  const s = audit.settings

  const propertyResults = useMemo(() =>
    audit.properties.map(property => {
      const propCrms = audit.crms.filter(c => c.propertyId === property.id)
      return { property, result: calculatePropertyResults(property, propCrms, s) }
    }),
    [audit]
  )

  const totals = useMemo(() => propertyResults.reduce((acc, { result: r }) => ({
    totalCapex:       acc.totalCapex       + r.totalCapex,
    totalGrantAvail:  acc.totalGrantAvail  + r.totalGrantAvail,
    netCost:          acc.netCost          + r.netCost,
    totalBillSaving:  acc.totalBillSaving  + r.totalBillSavingPence,
    totalLtCo2:       acc.totalLtCo2       + r.totalLtCo2,
  }), { totalCapex: 0, totalGrantAvail: 0, netCost: 0, totalBillSaving: 0, totalLtCo2: 0 }),
    [propertyResults]
  )

  // Measure-level saving chart (top 10 by annual saving)
  const measureChart = useMemo(() => {
    const map = {}
    for (const crm of audit.crms.filter(c => c.include)) {
      const property = audit.properties.find(p => p.id === crm.propertyId)
      if (!property) continue
      const { billSavingPence } = calculateResidentialCRMSavings(crm, property)
      const name = crm.description || crm.crmType
      map[name] = (map[name] || 0) + billSavingPence / 100
    }
    return Object.entries(map)
      .map(([name, saving]) => ({ name, saving }))
      .sort((a, b) => b.saving - a.saving)
      .slice(0, 12)
  }, [audit.crms, audit.properties])

  // Priority list: included CRMs sorted by payback ascending
  const priorityList = useMemo(() => {
    const items = []
    for (const crm of audit.crms.filter(c => c.include)) {
      const property = audit.properties.find(p => p.id === crm.propertyId)
      if (!property) continue
      const { billSavingPence } = calculateResidentialCRMSavings(crm, property)
      const ltCo2   = calculateResidentialLtCo2(crm, property, s)
      const grants  = checkGrantEligibility(property, crm)
      const grant   = grants.reduce((sum, g) => sum + (g.value || 0), 0)
      const netCost = crm.capexCost - grant
      const payback = billSavingPence > 0 ? netCost / (billSavingPence / 100) : Infinity
      items.push({ crm, property, billSavingPence, ltCo2, grant, netCost, payback, grantNames: grants.map(g => g.name) })
    }
    return items.sort((a, b) => a.payback - b.payback)
  }, [audit.crms, audit.properties, s])

  const overallPayback = totals.totalBillSaving > 0
    ? totals.netCost / (totals.totalBillSaving / 100) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard label="Total Investment" value={fmtGbp(totals.netCost)} sub={totals.totalGrantAvail > 0 ? `after ${fmtGbp(totals.totalGrantAvail)} grants` : undefined} colour="blue" />
        <StatCard label="Annual Bill Saving" value={fmtPounds(totals.totalBillSaving)} sub="/yr" colour="green" />
        <StatCard label="Simple Payback" value={fmtYrs(overallPayback)} colour="amber" />
        <StatCard label="Net LTtCO₂e" value={fmtTco2(totals.totalLtCo2)} colour="purple" />
      </div>

      {/* Property breakdown */}
      {audit.properties.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Property Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Property</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">CapEx</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Grants</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Net Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Bill Saving</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Payback</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">LTtCO₂e</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {propertyResults.map(({ property, result: r }) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{property.address || 'Unnamed'}</p>
                      <p className="text-xs text-gray-400">{property.propertyType} · EPC {property.currentEpcRating}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtGbp(r.totalCapex)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{r.totalGrantAvail > 0 ? fmtGbp(r.totalGrantAvail) : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmtGbp(r.netCost)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-medium">{fmtPounds(r.totalBillSavingPence)}/yr</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtYrs(r.simplePaybackYears)}</td>
                    <td className="px-3 py-2 text-right text-purple-700">{fmtTco2(r.totalLtCo2)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-3 py-2 text-gray-900">Total</td>
                  <td className="px-3 py-2 text-right">{fmtGbp(totals.totalCapex)}</td>
                  <td className="px-3 py-2 text-right text-green-700">{totals.totalGrantAvail > 0 ? fmtGbp(totals.totalGrantAvail) : '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtGbp(totals.netCost)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmtPounds(totals.totalBillSaving)}/yr</td>
                  <td className="px-3 py-2 text-right">{fmtYrs(overallPayback)}</td>
                  <td className="px-3 py-2 text-right text-purple-700">{fmtTco2(totals.totalLtCo2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart */}
      {measureChart.length > 0 && (
        <HorizontalBarChart data={measureChart} label="Annual Bill Saving by Measure (£/yr)" />
      )}

      {/* Priority list */}
      {priorityList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Priority List</h2>
          <p className="text-xs text-gray-500 mb-4">Included measures ranked by simple payback (quickest first)</p>
          <div className="flex flex-col gap-2">
            {priorityList.map(({ crm, property, billSavingPence, ltCo2, grant, netCost, payback, grantNames }, idx) => (
              <div key={crm.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{crm.description || crm.crmType}</p>
                  <p className="text-xs text-gray-400">{property.address}</p>
                </div>
                <div className="flex gap-4 text-xs text-right flex-shrink-0">
                  <div>
                    <p className="text-gray-400">Net cost</p>
                    <p className="font-medium text-gray-800">{fmtGbp(netCost)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Saving</p>
                    <p className="font-medium text-emerald-700">{fmtPounds(billSavingPence)}/yr</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Payback</p>
                    <p className="font-medium text-blue-700">{fmtYrs(payback)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">LTtCO₂e</p>
                    <p className="font-medium text-purple-700">{fmtTco2(ltCo2)}</p>
                  </div>
                  {grantNames.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {grantNames.map(n => (
                        <span key={n} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Results page ────────────────────────────────────────────────────────

export default function Results() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useAudit()
  const audit = state.audits[id]

  if (!audit) return <Layout><div className="text-center py-20 text-gray-500">Audit not found.</div></Layout>

  const includedCount = audit.crms.filter(c => c.include).length

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Results</h1>
            <p className="text-sm text-gray-500 mt-1">
              {audit.client?.name} · {includedCount} active measures
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportCSV(audit)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>

        {/* Print header (only visible when printing) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{audit.client?.name} — Energy Audit Report</h1>
          <p className="text-gray-500">Generated {new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</p>
        </div>

        {includedCount === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">No measures included yet.</p>
            <button onClick={() => navigate(`/audit/${id}/crm`)} className="text-blue-600 hover:underline text-sm">
              Go to CRM Builder to add measures
            </button>
          </div>
        ) : (
          audit.mode === 'commercial'
            ? <CommercialResults audit={audit} id={id} />
            : <ResidentialResults audit={audit} />
        )}

        <div className="flex justify-between pt-6 pb-8 print:hidden">
          <button onClick={() => navigate(`/audit/${id}/crm`)}
            className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            ← Back to CRM Builder
          </button>
        </div>
      </div>
    </Layout>
  )
}
