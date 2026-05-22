import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuditProvider } from './context/AuditContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AuditSetup from './pages/AuditSetup.jsx'
import AssetRegister from './pages/AssetRegister.jsx'
import CRMBuilder from './pages/CRMBuilder.jsx'
import Results from './pages/Results.jsx'

const router = createBrowserRouter([
  { path: '/',                        element: <Dashboard /> },
  { path: '/audit/:id/setup',         element: <AuditSetup /> },
  { path: '/audit/:id/assets',        element: <AssetRegister /> },
  { path: '/audit/:id/crm',           element: <CRMBuilder /> },
  { path: '/audit/:id/results',       element: <Results /> },
  { path: '*',                        element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <AuditProvider>
      <RouterProvider router={router} />
    </AuditProvider>
  )
}
