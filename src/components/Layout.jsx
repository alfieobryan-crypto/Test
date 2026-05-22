import { Link, useLocation, useParams } from 'react-router-dom'
import { useAudit } from '../context/AuditContext.jsx'

const steps = {
  commercial: [
    { label: 'Setup',   path: id => `/audit/${id}/setup` },
    { label: 'Assets',  path: id => `/audit/${id}/assets` },
    { label: 'CRM',     path: id => `/audit/${id}/crm` },
    { label: 'Results', path: id => `/audit/${id}/results` },
  ],
  residential: [
    { label: 'Setup',   path: id => `/audit/${id}/setup` },
    { label: 'CRM',     path: id => `/audit/${id}/crm` },
    { label: 'Results', path: id => `/audit/${id}/results` },
  ],
}

export default function Layout({ children }) {
  const { state } = useAudit()
  const { id } = useParams()
  const location = useLocation()

  const audit = id ? state.audits[id] : null
  const auditSteps = audit ? steps[audit.mode] : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            Energy Audit Tool
          </Link>
          {audit && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600 text-sm font-medium truncate max-w-48">
                {audit.client?.name || 'Unnamed Client'}
              </span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                audit.mode === 'commercial'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {audit.mode === 'commercial' ? 'Commercial' : 'Residential'}
              </span>
            </>
          )}
          <div className="flex-1" />
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            All Audits
          </Link>
        </div>

        {/* Step breadcrumb */}
        {auditSteps && (
          <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-1">
            {auditSteps.map((step, i) => {
              const href = step.path(id)
              const active = location.pathname === href
              return (
                <Link
                  key={step.label}
                  to={href}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {i + 1}
                  </span>
                  {step.label}
                </Link>
              )
            })}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  )
}
