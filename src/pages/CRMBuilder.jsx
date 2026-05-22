import { useParams, useNavigate } from 'react-router-dom'
import { useAudit } from '../context/AuditContext.jsx'
import Layout from '../components/Layout.jsx'

export default function CRMBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useAudit()
  const audit = state.audits[id]

  if (!audit) return <Layout><div className="text-center py-20 text-gray-500">Audit not found.</div></Layout>

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">CRM Builder</h1>
          <p className="text-gray-500 text-sm mb-6">Coming in Phase 3 — Carbon Reduction Measures</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate(`/audit/${id}/${audit.mode === 'commercial' ? 'assets' : 'setup'}`)}
              className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => navigate(`/audit/${id}/results`)}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-sm"
            >
              Next: Results →
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
