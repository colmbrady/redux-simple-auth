import {
  authenticate,
  createAuthenticator,
  createAuthMiddleware,
  reducer
} from '../src'
import {
  authenticateFailed,
  authenticateSucceeded,
  fetch as fetchAction,
  invalidateSession,
  updateSession,
  invalidateSessionFailed,
  restore
} from '../src/actions'
import { testAuthenticator } from './utils/authenticators'
import createMockStorage from './utils/testStorage'
import createStore from './utils/createStore'
import configureStore from 'redux-mock-store'
import warning from 'warning'

const storage = createMockStorage()

const sessionState = (overrides = {}) => ({
  session: {
    ...reducer(undefined, {}),
    ...overrides
  }
})

beforeEach(() => {
  fetch.resetMocks()
})

afterEach(() => {
  storage.reset()
  warning.reset()
})

it('throws when no authenticator is given', () => {
  expect(() =>
    createAuthMiddleware({
      storage,
      authenticator: undefined,
      authenticators: undefined
    })
  ).toThrow(
    'No authenticator was given. Be sure to configure an authenticator ' +
      'by using the `authenticator` option for a single authenticator or ' +
      'using the `authenticators` option to allow multiple authenticators'
  )
})

it('throws when authenticators are not an array', () => {
  expect(() =>
    createAuthMiddleware({ storage, authenticators: 'bloop' })
  ).toThrow(
    'Expected `authenticators` to be an array. If you only need a single ' +
      'authenticator, consider using the `authenticator` option.'
  )
})

it('throws when authenticator is an array', () => {
  expect(() => createAuthMiddleware({ storage, authenticator: [] })).toThrow(
    'Expected `authenticator` to be an object. If you need multiple ' +
      'authenticators, consider using the `authenticators` option.'
  )
})

it('persists changed authenticated data to storage', () => {
  const storage = createMockStorage()
  const middleware = createAuthMiddleware({
    storage,
    authenticator: testAuthenticator
  })
  const mockStore = configureStore([middleware])
  const getState = jest
    .fn()
    .mockReturnValueOnce(sessionState({ authenticator: null, data: {} }))
    .mockReturnValue(
      sessionState({
        authenticator: 'test',
        data: { token: '1234' }
      })
    )
  const store = mockStore(getState)

  store.dispatch({ type: 'test' })

  expect(storage.getData()).toEqual({
    authenticated: {
      authenticator: 'test',
      token: '1234'
    }
  })
})

it('hydrates session data from storage', () => {
  const restore = jest.fn(() => Promise.resolve())
  const authenticator = createAuthenticator({ name: 'test', restore })
  const storage = createMockStorage({
    authenticated: { authenticator: 'test', token: 1234 }
  })
  const middleware = createAuthMiddleware({ storage, authenticator })

  createStore({ middleware })

  expect(restore).toHaveBeenCalledWith({ token: 1234 })
})

describe('AUTHENTICATE dispatched', () => {
  it('authenticates with configured authenticator', () => {
    const authenticator = createAuthenticator({
      name: 'test',
      authenticate: jest.fn(() => Promise.resolve())
    })
    const middleware = createAuthMiddleware({
      storage,
      authenticator
    })
    const store = createStore({ middleware })
    const data = { username: 'test', password: 'password' }
    const action = authenticate('test', data)

    store.dispatch(action)

    expect(authenticator.authenticate).toHaveBeenCalledWith(data)
  })

  it('authenticates with matching authenticator', () => {
    const credsAuthenticator = createAuthenticator({
      name: 'creds',
      authenticate: jest.fn(() => Promise.resolve())
    })
    const testAuthenticator = createAuthenticator({
      name: 'test',
      authenticate: jest.fn(() => Promise.resolve())
    })
    const middleware = createAuthMiddleware({
      storage,
      authenticators: [credsAuthenticator, testAuthenticator]
    })
    const store = createStore({ middleware })
    const data = { username: 'test', password: 'password' }
    const action = authenticate('test', data)

    store.dispatch(action)

    expect(testAuthenticator.authenticate).toHaveBeenCalledWith(data)
    expect(credsAuthenticator.authenticate).not.toHaveBeenCalled()
  })

  it('throws error when authenticator is not found', () => {
    const authenticator = createAuthenticator({
      name: 'fake'
    })
    const middleware = createAuthMiddleware({
      storage,
      authenticators: [authenticator]
    })
    const store = createStore({ middleware })
    const action = authenticate('not-real', {})

    expect(() => store.dispatch(action)).toThrow(
      'No authenticator with name `not-real` was found. Be sure ' +
        'you have defined it in the authenticators config'
    )
  })

  it('dispatches AUTHENTICATE_SUCCEEDED when authenticated', async () => {
    const middleware = createAuthMiddleware({
      storage,
      authenticator: testAuthenticator
    })
    const mockStore = configureStore([middleware])
    const store = mockStore(sessionState())
    const data = { username: 'test', password: 'password' }
    const action = authenticate('test', data)
    const expectedAction = authenticateSucceeded('test', {
      token: 'abcdefg'
    })

    await store.dispatch(action)

    expect(store.getActions()).toContainEqual(expectedAction)
  })

  it('dispatches AUTHENTICATE_FAILED when authentication fails', async () => {
    const error = 'Nope'
    const authenticator = createAuthenticator({
      name: 'fail',
      authenticate: () => Promise.reject(error)
    })
    const middleware = createAuthMiddleware({ storage, authenticator })
    const mockStore = configureStore([middleware])
    const store = mockStore({ session: reducer(undefined, {}) })
    const data = { username: 'test', password: 'password' }
    const action = authenticate('test', data)

    try {
      await store.dispatch(action)
    } catch (e) {}

    expect(store.getActions()).toContainEqual(authenticateFailed(error))
  })

  it('returns rejected promise when authentication fails', async () => {
    const error = 'Not today'
    const authenticator = createAuthenticator({
      name: 'fail',
      authenticate: () => Promise.reject(error)
    })
    const middleware = createAuthMiddleware({ storage, authenticator })
    const store = createStore({ middleware })
    const data = { username: 'test', password: 'password' }
    const action = authenticate('test', data)

    const promise = store.dispatch(action)

    await expect(promise).rejects.toEqual(authenticateFailed(error))
  })
})

describe('INVALIDATE_SESSION dispatched', () => {
  it('invalidates with configured authenticator', () => {
    const authenticator = createAuthenticator({
      name: 'test',
      invalidate: jest.fn(() => Promise.resolve())
    })
    const middleware = createAuthMiddleware({ storage, authenticator })
    const data = { token: 1234 }
    const store = createStore({
      middleware,
      initialState: sessionState({
        isAuthenticated: true,
        authenticator: 'test',
        data
      })
    })
    const invalidateAction = invalidateSession()

    store.dispatch(invalidateAction)

    expect(authenticator.invalidate).toHaveBeenCalledWith(data)
  })

  it('dispatches INVALIDATE_SESSION_FAILED if authenticator fails to invalidate', async () => {
    const authenticator = createAuthenticator({
      name: 'test',
      invalidate: () => Promise.reject()
    })
    const middleware = createAuthMiddleware({ storage, authenticator })
    const mockStore = configureStore([middleware])
    const store = mockStore({
      session: { isAuthenticated: true, authenticator: 'test' }
    })
    const invalidateAction = invalidateSession()

    try {
      await store.dispatch(invalidateAction)
    } catch (e) {}

    expect(store.getActions()).toContainEqual(invalidateSessionFailed())
  })

  it('returns rejected promise when authenticator fails to invalidate', async () => {
    const authenticator = createAuthenticator({
      name: 'test',
      invalidate: () => Promise.reject()
    })
    const middleware = createAuthMiddleware({ storage, authenticator })
    const store = createStore({
      middleware,
      initialState: sessionState({
        isAuthenticated: true,
        authenticator: 'test'
      })
    })

    const promise = store.dispatch(invalidateSession())

    await expect(promise).rejects.toEqual(invalidateSessionFailed())
  })

  it('dispatches INVALIDATE_SESSION_FAILED if not authenticated', async () => {
    const middleware = createAuthMiddleware({
      storage,
      authenticator: testAuthenticator
    })
    const mockStore = configureStore([middleware])
    const store = mockStore(sessionState())

    try {
      await store.dispatch(invalidateSession())
    } catch (e) {}

    expect(store.getActions()).toContainEqual(invalidateSessionFailed())
  })

  it('warns if not authenticated', async () => {
    const store = createStore({
      middleware: createAuthMiddleware({
        storage,
        authenticator: testAuthenticator
      })
    })

    try {
      await store.dispatch(invalidateSession())
    } catch (e) {}

    expect(warning.getWarnings()).toContainEqual(
      'You are trying to invalidate a session that is not authenticated.'
    )
  })

  it('returns rejected promise with action when not authenticated', async () => {
    const store = createStore({
      middleware: createAuthMiddleware({
        storage,
        authenticator: testAuthenticator
      })
    })

    const promise = store.dispatch(invalidateSession())

    await expect(promise).rejects.toEqual(invalidateSessionFailed())
  })

  it('throws error when authenticator does not exist', () => {
    const authenticator = createAuthenticator({
      name: 'fake'
    })
    const middleware = createAuthMiddleware({
      storage,
      authenticators: [authenticator]
    })
    const mockStore = configureStore([middleware])
    const store = mockStore({
      session: { isAuthenticated: true, authenticator: 'nope' }
    })
    const action = invalidateSession()

    expect(() => store.dispatch(action)).toThrow(
      'No authenticator with name `nope` was found. Be sure ' +
        'you have defined it in the authenticators config'
    )
  })
})

describe('FETCH dispatched', () => {
  it('uses global fetch to make network call', () => {
    fetch.mockResponse(JSON.stringify({ ok: true }))
    const middleware = createAuthMiddleware({
      storage,
      authenticator: testAuthenticator
    })
    const store = createStore({ middleware })

    store.dispatch(fetchAction('https://test.com'))

    expect(fetch).toHaveBeenCalledWith('https://test.com', { headers: {} })
  })

  it('passes request options to fetch', () => {
    fetch.mockResponse(JSON.stringify({ ok: true }))
    const middleware = createAuthMiddleware({
      storage,
      authenticator: testAuthenticator
    })
    const store = createStore({ middleware })

    store.dispatch(
      fetchAction('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com' })
      })
    )

    expect(fetch).toHaveBeenCalledWith('https://test.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' })
    })
  })

  it('authorizes with configured authenticator', () => {
    fetch.mockResponse(JSON.stringify({ ok: true }))
    const authorize = jest.fn()
    const middleware = createAuthMiddleware({
      storage,
      authorize,
      authenticator: testAuthenticator
    })
    const data = { token: '1235' }
    const store = createStore({
      middleware,
      initialState: sessionState({ data })
    })

    store.dispatch(fetchAction('https://test.com'))

    expect(authorize).toHaveBeenCalledWith(data, expect.any(Function), expect.any(Function), 'https://test.com')
  })

  it('sets headers defined in authorize function', () => {
    fetch.mockResponse(JSON.stringify({ ok: true }))
    const middleware = createAuthMiddleware({
      storage,
      authorize: (data, headers) => {
        headers('Authorization', data.token)
      },
      authenticator: testAuthenticator
    })
    const store = createStore({
      middleware,
      initialState: sessionState({ data: { token: '1235' } })
    })

    store.dispatch(fetchAction('https://test.com'))

    expect(fetch).toHaveBeenCalledWith('https://test.com', {
      headers: { Authorization: '1235' }
    })
  })

  it('sets options defined in authorize function', () => {
    fetch.mockResponse(JSON.stringify({ ok: true }))
    const middleware = createAuthMiddleware({
      storage,
      authorize: (data, headers, options) => {
        options('credentials', 'same-origin')
      },
      authenticator: testAuthenticator
    })
    const store = createStore({
      middleware,
      initialState: sessionState({ data: { token: '1235' } })
    })

    store.dispatch(fetchAction('https://test.com'))

    expect(fetch).toHaveBeenCalledWith('https://test.com', {
      credentials: 'same-origin',
      headers: {}
    })
  })

  describe('when refresh option is set', () => {
    it('dispatches update session action', async () => {
      fetch.mockResponse(JSON.stringify({ ok: true }), {
        headers: {
          'x-access-token': '6789'
        }
      })
      const middleware = createAuthMiddleware({
        storage,
        authenticator: testAuthenticator,
        refresh: response => ({
          token: response.headers.get('x-access-token')
        })
      })
      const mockStore = configureStore([middleware])
      const data = { token: '1235' }
      const store = mockStore({ session: { data } })
      const updateAction = updateSession({ token: '6789' })

      await store.dispatch(fetchAction('https://test.com'))

      expect(store.getActions()).toEqual(expect.arrayContaining([updateAction]))
    })

    it('does not dispatch when returning null', async () => {
      fetch.mockResponse(JSON.stringify({ ok: true }), {
        headers: {
          'x-access-token': '6789'
        }
      })
      const middleware = createAuthMiddleware({
        storage,
        authenticator: testAuthenticator,
        refresh: () => null
      })
      const mockStore = configureStore([middleware])
      const data = { token: '1235' }
      const store = mockStore({ session: { data } })
      const updateAction = updateSession(null)

      await store.dispatch(fetchAction('https://test.com'))

      expect(store.getActions()).not.toEqual(
        expect.arrayContaining([updateAction])
      )
    })
  })

  it('does not dispatch invalidate action when request succeeds', async () => {
    fetch.mockResponse(JSON.stringify({ ok: true }))
    const middleware = createAuthMiddleware({
      storage,
      authenticator: testAuthenticator
    })
    const mockStore = configureStore([middleware])
    const data = { token: '1235' }
    const store = mockStore({ session: { data } })
    const invalidateAction = invalidateSession()

    await store.dispatch(fetchAction('https://test.com'))

    expect(store.getActions()).not.toContainEqual(invalidateAction)
  })

  describe('when request returns 401 unauthorized', () => {
    it('dispatches INVALIDATE_SESSION', async () => {
      fetch.mockResponse(JSON.stringify({ ok: true }), { status: 401 })
      const middleware = createAuthMiddleware({
        storage,
        authenticator: testAuthenticator
      })
      const mockStore = configureStore([middleware])
      const data = { token: '1235' }
      const store = mockStore({
        session: { data, isAuthenticated: true, authenticator: 'test' }
      })

      await store.dispatch(fetchAction('https://test.com'))

      expect(store.getActions()).toContainEqual(invalidateSession())
    })

    it('does not dispatch if not authenticated', async () => {
      fetch.mockResponse(JSON.stringify({ ok: true }), { status: 401 })
      const middleware = createAuthMiddleware({
        storage,
        authenticator: testAuthenticator
      })
      const mockStore = configureStore([middleware])
      const data = { token: '1235' }
      const store = mockStore({ session: { data, isAuthenticated: false } })
      const invalidateAction = invalidateSession()

      await store.dispatch(fetchAction('https://test.com'))

      expect(store.getActions()).not.toContainEqual(invalidateAction)
    })
  })
})
