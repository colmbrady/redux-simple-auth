import * as fromSession from './reducer'

export const getSessionData = state => fromSession.getData(state.session)

export const getIsAuthenticated = state =>
  fromSession.getIsAuthenticated(state.session)

export const getAuthenticator = state =>
  fromSession.getAuthenticator(state.session)

export const getIsRestored = state => fromSession.getIsRestored(state.session)

export const getLastError = state => fromSession.getLastError(state.session)

export const getHasFailedAuth = state =>
  fromSession.getHasFailedAuth(state.session)
