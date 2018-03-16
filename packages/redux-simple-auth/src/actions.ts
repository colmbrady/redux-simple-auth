import {
  AUTHENTICATE,
  AUTHENTICATE_FAILED,
  AUTHENTICATE_SUCCEEDED,
  FETCH,
  INITIALIZE,
  INVALIDATE_SESSION,
  INVALIDATE_SESSION_FAILED,
  UPDATE_SESSION,
  CLEAR_ERROR,
  RESTORE,
  RESTORE_FAILED,
  SYNC_TAB
} from './actionTypes'
import { Authenticator } from './types'

export const authenticate = (authenticator: Authenticator, payload: any) => ({
  type: AUTHENTICATE,
  meta: { authenticator },
  payload
})

export const authenticateSucceeded = (
  authenticator: Authenticator,
  payload: any
) => ({
  type: AUTHENTICATE_SUCCEEDED,
  meta: { authenticator },
  payload
})

export const authenticateFailed = (payload: any) => ({
  type: AUTHENTICATE_FAILED,
  payload
})

export const fetch = (url: string, options: any) => ({
  type: FETCH,
  payload: { url, options }
})

export const clearError = () => ({
  type: CLEAR_ERROR
})

export const invalidateSession = () => ({
  type: INVALIDATE_SESSION
})

export const invalidateSessionFailed = () => ({
  type: INVALIDATE_SESSION_FAILED
})

export const updateSession = (payload: any) => ({
  type: UPDATE_SESSION,
  payload
})

export const restore = (payload: any) => ({
  type: RESTORE,
  payload
})

export const restoreFailed = () => ({
  type: RESTORE_FAILED
})

export const initialize = (payload: any) => ({
  type: INITIALIZE,
  payload
})

export const syncTab = (payload: any) => ({
  type: SYNC_TAB,
  payload
})
