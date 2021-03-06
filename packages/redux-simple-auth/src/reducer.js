import {
  AUTHENTICATE_FAILED,
  AUTHENTICATE_SUCCEEDED,
  INITIALIZE,
  INVALIDATE_SESSION,
  CLEAR_ERROR,
  RESTORE,
  RESTORE_FAILED,
  SYNC_TAB,
  UPDATE_SESSION
} from './actionTypes'

const initialState = {
  authenticator: null,
  hasFailedAuth: false,
  isAuthenticated: false,
  isRestored: false,
  lastError: null,
  data: {}
}

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case INITIALIZE:
      const { authenticated: { authenticator, ...data } = {} } = action.payload

      return {
        ...initialState,
        authenticator,
        data
      }
    case AUTHENTICATE_SUCCEEDED:
      return {
        ...state,
        hasFailedAuth: false,
        authenticator: action.meta.authenticator,
        isAuthenticated: true,
        data: action.payload,
        lastError: null
      }
    case AUTHENTICATE_FAILED:
      return {
        ...state,
        authenticator: null,
        hasFailedAuth: true,
        isAuthenticated: false,
        isRestored: true,
        lastError: action.payload,
        data: {}
      }
    case CLEAR_ERROR:
      return {
        ...state,
        hasFailedAuth: false,
        lastError: null
      }
    case INVALIDATE_SESSION:
    case RESTORE_FAILED:
      return {
        ...state,
        authenticator: null,
        isAuthenticated: false,
        isRestored: true,
        lastError: null,
        data: {}
      }
    case RESTORE: {
      const { authenticator, ...data } = action.payload

      return {
        ...state,
        authenticator,
        data,
        isAuthenticated: true,
        isRestored: true,
        lastError: null
      }
    }
    case UPDATE_SESSION:
      return {
        ...state,
        data: action.payload
      }
    case SYNC_TAB: {
      const {
        isAuthenticated,
        authenticated: { authenticator, ...data }
      } = action.payload

      return {
        ...state,
        isAuthenticated,
        authenticator,
        data
      }
    }
    default:
      return state
  }
}

export default reducer

export const getData = state => state.data
export const getIsAuthenticated = state => state.isAuthenticated
export const getAuthenticator = state => state.authenticator
export const getIsRestored = state => state.isRestored
export const getLastError = state => state.lastError
export const getHasFailedAuth = state => state.hasFailedAuth
