import { createContext, useContext, useReducer, useEffect } from 'react'
import { reducer, INITIAL_STATE } from './reducer.js'

const AuditContext = createContext(null)

const STORAGE_KEY = 'energy-audit-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : INITIAL_STATE
  } catch {
    return INITIAL_STATE
  }
}

export function AuditProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage quota exceeded — silently continue
    }
  }, [state])

  return (
    <AuditContext.Provider value={{ state, dispatch }}>
      {children}
    </AuditContext.Provider>
  )
}

export function useAudit() {
  const ctx = useContext(AuditContext)
  if (!ctx) throw new Error('useAudit must be used inside AuditProvider')
  return ctx
}

export function useCurrentAudit() {
  const { state } = useAudit()
  return state.currentAuditId ? state.audits[state.currentAuditId] : null
}
