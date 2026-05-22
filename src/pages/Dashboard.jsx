import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext.jsx'
import { ACTIONS } from '../context/reducer.js'
import Modal from '../components/Modal.jsx'
import { Field, Input } from '../components/Field.jsx'

function newId() {
  return crypto.randomUUID()
}

function NewAuditModal({ onClose }) {
  const { dispatch } = useAudit()
  const navigate = useNavigate()
  const [mode, setMode] = useState('commercial')
  const [clientName, setClientName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  function handleCreate(e) {
    e.preventDefault()
    if (!clientName.trim()) return
    const id = newId()
    dispatch({
      type: ACTIONS.CREATE_AUDIT,
      payload: { id, mode, client: { name: clientName.trim(), email: contactEmail.trim() } },
    })
    navigate(`/audit/${id}/setup`)
    onClose()
  }

  return (
    <Modal title="New Audit" onClose={onClose}>
      <form onSubmit={handleCreate} className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Audit mode</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'commercial', label: 'Commercial / Public Sector', desc: 'Multi-site, asset-level modelling, Salix funding' },
              { value: 'residential', label: 'Residential', desc: 'Single property or small portfolio, bill-based, grant checker' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  mode === opt.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Field label="Client name">
          <Input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="e.g. Northshire Council"
            autoFocus
            required
          />
        </Field>

        <Field label="Contact email (optional)">
          <Input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="client@example.com"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!clientName.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Audit
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AuditCard({ audit }) {
  const navigate = useNavigate()
  const { dispatch } = useAudit()

  const siteCount     = audit.sites?.length ?? 0
  const assetCount    = audit.assets?.length ?? 0
  const propCount     = audit.properties?.length ?? 0
  const crmCount      = audit.crms?.filter(c => c.include).length ?? 0
  const createdDate   = new Date(audit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  function handleDelete(e) {
    e.stopPropagation()
    if (confirm(`Delete audit for "${audit.client?.name}"? This cannot be undone.`)) {
      dispatch({ type: ACTIONS.DELETE_AUDIT, payload: { id: audit.id } })
    }
  }

  return (
    <div
      onClick={() => navigate(`/audit/${audit.id}/setup`)}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{audit.client?.name || 'Unnamed Client'}</h3>
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
              audit.mode === 'commercial'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {audit.mode === 'commercial' ? 'Commercial' : 'Residential'}
            </span>
          </div>
          {audit.client?.email && (
            <p className="text-sm text-gray-500 mb-3">{audit.client.email}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {audit.mode === 'commercial' ? (
              <>
                <span>{siteCount} {siteCount === 1 ? 'site' : 'sites'}</span>
                <span>{assetCount} {assetCount === 1 ? 'asset' : 'assets'}</span>
              </>
            ) : (
              <span>{propCount} {propCount === 1 ? 'property' : 'properties'}</span>
            )}
            <span>{crmCount} active CRMs</span>
            <span>Created {createdDate}</span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1 rounded"
          title="Delete audit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { state } = useAudit()
  const [showNewModal, setShowNewModal] = useState(false)

  const audits = Object.values(state.audits).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Energy Audit Tool</h1>
            <p className="text-gray-500 text-sm mt-1">Carbon reduction & decarbonisation planning</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Audit
          </button>
        </div>

        {/* Audit list */}
        {audits.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No audits yet</h2>
            <p className="text-gray-500 text-sm mb-6">Create your first audit to get started</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create your first audit
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {audits.map(audit => (
              <AuditCard key={audit.id} audit={audit} />
            ))}
          </div>
        )}
      </div>

      {showNewModal && <NewAuditModal onClose={() => setShowNewModal(false)} />}
    </div>
  )
}
