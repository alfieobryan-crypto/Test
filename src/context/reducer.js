import { calculateAssetKwh } from '../engine/calculations.js'

export const ACTIONS = {
  SET_CURRENT_AUDIT: 'SET_CURRENT_AUDIT',
  CREATE_AUDIT:      'CREATE_AUDIT',
  UPDATE_CLIENT:     'UPDATE_CLIENT',
  UPDATE_SETTINGS:   'UPDATE_SETTINGS',
  DELETE_AUDIT:      'DELETE_AUDIT',
  // Commercial
  ADD_SITE:          'ADD_SITE',
  UPDATE_SITE:       'UPDATE_SITE',
  DELETE_SITE:       'DELETE_SITE',
  ADD_BUILDING:      'ADD_BUILDING',
  UPDATE_BUILDING:   'UPDATE_BUILDING',
  DELETE_BUILDING:   'DELETE_BUILDING',
  ADD_ASSET:         'ADD_ASSET',
  UPDATE_ASSET:      'UPDATE_ASSET',
  DELETE_ASSET:      'DELETE_ASSET',
  // Residential
  ADD_PROPERTY:      'ADD_PROPERTY',
  UPDATE_PROPERTY:   'UPDATE_PROPERTY',
  DELETE_PROPERTY:   'DELETE_PROPERTY',
}

export const DEFAULT_SETTINGS = {
  gasCarbonFactor:             0.00018387,
  elecCarbonFactor:            0.00019121,
  gasUnitRatePkWh:             6,
  elecUnitRatePkWh:            28,
  salixCarbonPricePer_LTtCO2:  95,
  likeForLikeReplacementCost:  0,
}

export const INITIAL_STATE = {
  currentAuditId: null,
  audits: {},
}

function withUpdatedAt(audit) {
  return { ...audit, updatedAt: new Date().toISOString() }
}

function recalcAsset(asset) {
  return { ...asset, annualKwhConsumed: calculateAssetKwh(asset) }
}

export function reducer(state, action) {
  const { type, payload } = action

  switch (type) {
    case ACTIONS.SET_CURRENT_AUDIT:
      return { ...state, currentAuditId: payload.id }

    case ACTIONS.CREATE_AUDIT: {
      const { id, mode, client } = payload
      return {
        ...state,
        currentAuditId: id,
        audits: {
          ...state.audits,
          [id]: {
            id,
            mode,
            client,
            settings: { ...DEFAULT_SETTINGS },
            sites: [],
            buildings: [],
            assets: [],
            properties: [],
            crms: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      }
    }

    case ACTIONS.DELETE_AUDIT: {
      const { [payload.id]: _removed, ...rest } = state.audits
      return {
        ...state,
        currentAuditId: state.currentAuditId === payload.id ? null : state.currentAuditId,
        audits: rest,
      }
    }

    case ACTIONS.UPDATE_CLIENT: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({ ...audit, client: { ...audit.client, ...payload.client } }),
        },
      }
    }

    case ACTIONS.UPDATE_SETTINGS: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({ ...audit, settings: { ...audit.settings, ...payload.settings } }),
        },
      }
    }

    // ─── Commercial ──────────────────────────────────────────────────────────

    case ACTIONS.ADD_SITE: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({ ...audit, sites: [...audit.sites, payload.site] }),
        },
      }
    }

    case ACTIONS.UPDATE_SITE: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            sites: audit.sites.map(s => s.id === payload.site.id ? { ...s, ...payload.site } : s),
          }),
        },
      }
    }

    case ACTIONS.DELETE_SITE: {
      const audit = state.audits[payload.auditId]
      const siteId = payload.siteId
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            sites:     audit.sites.filter(s => s.id !== siteId),
            buildings: audit.buildings.filter(b => b.siteId !== siteId),
            assets:    audit.assets.filter(a => a.siteId !== siteId),
            crms:      audit.crms.filter(c => c.siteId !== siteId),
          }),
        },
      }
    }

    case ACTIONS.ADD_BUILDING: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({ ...audit, buildings: [...audit.buildings, payload.building] }),
        },
      }
    }

    case ACTIONS.UPDATE_BUILDING: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            buildings: audit.buildings.map(b => b.id === payload.building.id ? { ...b, ...payload.building } : b),
          }),
        },
      }
    }

    case ACTIONS.DELETE_BUILDING: {
      const audit = state.audits[payload.auditId]
      const bldgId = payload.buildingId
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            buildings: audit.buildings.filter(b => b.id !== bldgId),
            assets:    audit.assets.filter(a => a.buildingId !== bldgId),
            crms:      audit.crms.filter(c => c.buildingId !== bldgId),
          }),
        },
      }
    }

    case ACTIONS.ADD_ASSET: {
      const audit = state.audits[payload.auditId]
      const asset = recalcAsset(payload.asset)
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({ ...audit, assets: [...audit.assets, asset] }),
        },
      }
    }

    case ACTIONS.UPDATE_ASSET: {
      const audit = state.audits[payload.auditId]
      const asset = recalcAsset(payload.asset)
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            assets: audit.assets.map(a => a.id === asset.id ? asset : a),
          }),
        },
      }
    }

    case ACTIONS.DELETE_ASSET: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            assets: audit.assets.filter(a => a.id !== payload.assetId),
            crms:   audit.crms.filter(c => c.assetId !== payload.assetId),
          }),
        },
      }
    }

    // ─── Residential ─────────────────────────────────────────────────────────

    case ACTIONS.ADD_PROPERTY: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({ ...audit, properties: [...audit.properties, payload.property] }),
        },
      }
    }

    case ACTIONS.UPDATE_PROPERTY: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            properties: audit.properties.map(p => p.id === payload.property.id ? { ...p, ...payload.property } : p),
          }),
        },
      }
    }

    case ACTIONS.DELETE_PROPERTY: {
      const audit = state.audits[payload.auditId]
      return {
        ...state,
        audits: {
          ...state.audits,
          [payload.auditId]: withUpdatedAt({
            ...audit,
            properties: audit.properties.filter(p => p.id !== payload.propertyId),
            crms:       audit.crms.filter(c => c.propertyId !== payload.propertyId),
          }),
        },
      }
    }

    default:
      return state
  }
}
