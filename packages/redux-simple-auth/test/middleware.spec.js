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
  updateSession
} from '../src/actions'
import {
  failAuthenticator,
  spiedAuthenticator,
  successAuthenticator
} from './utils/authenticators'
import createMockStorage from './utils/testStorage'
import configureStore from 'redux-mock-store'

const storage = createMockStorage()

const configureMiddleware = (...authenticators) =>
  createAuthMiddleware({ storage, authenticators })

beforeEach(() => {
  fetch.resetMocks()
})

afterEach(() => {
  storage.persist.mockClear()
  storage.restore.mockClear()
})

describe('auth middleware', () => {
  it('returns a function that handles {getState, dispatch}', () => {
    const middleware = createAuthMiddleware({
      storage,
      authenticator: spiedAuthenticator
    })
    expect(middleware).toBeInstanceOf(Function)
    expect(middleware.length).toBe(1)
  })

  describe('store handler', () => {
    it('returns function that handles next', () => {
      const middleware = createAuthMiddleware({
        storage,
        authenticator: spiedAuthenticator
      })
      const nextHandler = middleware({})

      expect(nextHandler).toBeInstanceOf(Function)
      expect(nextHandler.length).toBe(1)
    })
  })

  describe('action handler', () => {
    it('action handler returns a function that handles action', () => {
      const middleware = createAuthMiddleware({
        storage,
        authenticator: spiedAuthenticator
      })
      const nextHandler = middleware({})
      const actionHandler = nextHandler()

      expect(actionHandler).toBeInstanceOf(Function)
      expect(actionHandler.length).toBe(1)
    })
  })

  describe('config', () => {
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
        createAuthMiddleware({ storage, authenticators: spiedAuthenticator })
      ).toThrow(
        'Expected `authenticators` to be an array. If you only need a single ' +
          'authenticator, consider using the `authenticator` option.'
      )
    })

    it('throws when authenticator is an array', () => {
      expect(() =>
        createAuthMiddleware({ storage, authenticator: [spiedAuthenticator] })
      ).toThrow(
        'Expected `authenticator` to be an object. If you need multiple ' +
          'authenticators, consider using the `authenticators` option.'
      )
    })
  })

  describe('when authenticated data changes', () => {
    it('persists changes to storage', () => {
      const middleware = configureMiddleware(successAuthenticator)
      const mockStore = configureStore([middleware])
      const getState = jest
        .fn()
        .mockReturnValueOnce({
          session: { authenticator: null, data: {} }
        })
        .mockReturnValueOnce({
          session: { authenticator: 'test', data: { token: '1234' } }
        })
      const store = mockStore(getState)

      store.dispatch({ type: 'test' })

      expect(storage.persist).toHaveBeenCalledWith({
        authenticated: {
          authenticator: 'test',
          token: '1234'
        }
      })
    })
  })

  describe('when authenticating', () => {
    it('calls authenticators authenticate', () => {
      const middleware = configureMiddleware(spiedAuthenticator)
      const mockStore = configureStore([middleware])
      const store = mockStore()
      const data = { username: 'test', password: 'password' }
      const action = authenticate('test', data)

      store.dispatch(action)

      expect(spiedAuthenticator.authenticate).toHaveBeenCalledWith(data)

      spiedAuthenticator.authenticate.mockClear()
    })

    it('allows single authenticator', () => {
      const middleware = createAuthMiddleware({
        storage,
        authenticator: spiedAuthenticator
      })
      const mockStore = configureStore([middleware])
      const store = mockStore()
      const data = { username: 'test', password: 'password' }
      const action = authenticate('test', data)

      store.dispatch(action)

      expect(spiedAuthenticator.authenticate).toHaveBeenCalledWith(data)

      spiedAuthenticator.authenticate.mockClear()
    })

    describe('when authenticator is not found', () => {
      it('throws error', () => {
        const authenticator = createAuthenticator({
          name: 'fake'
        })
        const middleware = configureMiddleware(authenticator)
        const mockStore = configureStore([middleware])
        const store = mockStore()
        const action = authenticate('not-real', {})

        expect(() => store.dispatch(action)).toThrow(
          'No authenticator with name `not-real` was found. Be sure ' +
            'you have defined it in the authenticators config'
        )
      })
    })

    describe('when successful', () => {
      const middleware = configureMiddleware(successAuthenticator)
      const mockStore = configureStore([middleware])

      it('sets authenticated data on local storage', async () => {
        const initialState = reducer(undefined, {})
        const getState = jest
          .fn()
          .mockReturnValueOnce({ session: {} }) // restore
          .mockReturnValueOnce({ session: {} }) // restore
          .mockReturnValueOnce({ session: initialState })
          .mockReturnValueOnce({
            session: reducer(
              initialState,
              authenticateSucceeded('test', { token: '1234' })
            )
          })
        const store = mockStore(getState)
        const data = { username: 'test', password: 'password' }
        const action = authenticate('test', data)

        await store.dispatch(action)

        expect(storage.persist).toHaveBeenCalledWith({
          authenticated: {
            token: '1234',
            authenticator: 'test'
          }
        })
      })

      it('dispatches AUTHENTICATE_SUCCEEDED', async () => {
        const store = mockStore({ session: reducer(undefined, {}) })
        const data = { username: 'test', password: 'password' }
        const action = authenticate('test', data)
        const expectedAction = authenticateSucceeded('test', {
          token: 'abcdefg'
        })

        await store.dispatch(action)

        expect(store.getActions()).toContainEqual(expectedAction)
      })
    })

    describe('when not successful', () => {
      it('dispatches AUTHENTICATE_FAILED', async () => {
        const middleware = configureMiddleware(failAuthenticator)
        const mockStore = configureStore([middleware])
        const store = mockStore({ session: { isAuthenticated: false } })
        const data = { username: 'test', password: 'password' }
        const action = authenticate('test', data)

        await store.dispatch(action)

        expect(store.getActions()).toContainEqual(authenticateFailed())
      })
    })
  })

  describe('when invalidating', () => {
    it('calls authenticators invalidate', () => {
      const middleware = configureMiddleware(spiedAuthenticator)
      const mockStore = configureStore([middleware])
      const data = { username: 'test', password: 'password' }
      // It uses the authenticator name in the store to decide find the
      // invalidate function.
      const store = mockStore({ session: { authenticator: 'test', data } })
      const invalidateAction = invalidateSession()

      store.dispatch(invalidateAction)
      expect(spiedAuthenticator.invalidate).toHaveBeenCalledWith(data)

      spiedAuthenticator.authenticate.mockClear()
      spiedAuthenticator.invalidate.mockClear()
    })

    describe('when redux store authenticator is not found', () => {
      it('throws error', () => {
        const authenticator = createAuthenticator({
          name: 'fake'
        })
        const middleware = configureMiddleware(authenticator)
        const mockStore = configureStore([middleware])
        const store = mockStore()
        const action = authenticate('not-real', {})

        expect(() => store.dispatch(action)).toThrow(
          'No authenticator with name `not-real` was found. Be sure ' +
            'you have defined it in the authenticators config'
        )
      })
    })

    describe('when there is no authenticator', () => {
      it('throws error', () => {
        const authenticator = createAuthenticator({
          name: 'fake'
        })
        const middleware = configureMiddleware(authenticator)
        const mockStore = configureStore([middleware])
        const store = mockStore()
        const action = authenticate('not-real', {})

        expect(() => store.dispatch(action)).toThrow(
          'No authenticator with name `not-real` was found. Be sure ' +
            'you have defined it in the authenticators config'
        )
      })
    })
  })

  describe('session restoration', () => {
    it('hydrates session data from storage', () => {
      const middleware = configureMiddleware()
      const mockStore = configureStore([middleware])
      mockStore({ session: { isAuthenticated: false } })

      expect(storage.restore).toHaveBeenCalled()
    })
  })

  describe('when fetch action is dispatched', () => {
    it('fetches data', () => {
      fetch.mockResponse(JSON.stringify({ ok: true }))
      const middleware = configureMiddleware()
      const mockStore = configureStore([middleware])
      const store = mockStore({ session: reducer(undefined, {}) })

      store.dispatch(fetchAction('https://test.com'))

      expect(fetch).toHaveBeenCalledWith('https://test.com', { headers: {} })
    })

    it('passes request options to fetch', () => {
      fetch.mockResponse(JSON.stringify({ ok: true }))
      const middleware = configureMiddleware()
      const mockStore = configureStore([middleware])
      const store = mockStore({ session: reducer(undefined, {}) })

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

    it('calls authorize with authenticated data', () => {
      fetch.mockResponse(JSON.stringify({ ok: true }))
      const authorize = jest.fn()
      const middleware = createAuthMiddleware({
        storage,
        authorize,
        authenticator: spiedAuthenticator
      })
      const mockStore = configureStore([middleware])
      const data = { token: '1235' }
      const store = mockStore({ session: { data } })

      store.dispatch(fetchAction('https://test.com'))

      expect(authorize).toHaveBeenCalledWith(data, expect.any(Function))
    })

    it('sets headers when authorize runs block function', () => {
      fetch.mockResponse(JSON.stringify({ ok: true }))
      const authorize = (data, block) => {
        block('Authorization', data.token)
      }
      const middleware = createAuthMiddleware({
        storage,
        authorize,
        authenticator: spiedAuthenticator
      })
      const mockStore = configureStore([middleware])
      const data = { token: '1235' }
      const store = mockStore({ session: { data } })

      store.dispatch(fetchAction('https://test.com'))

      expect(fetch).toHaveBeenCalledWith('https://test.com', {
        headers: { Authorization: '1235' }
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
          authenticator: successAuthenticator,
          refresh: response => ({
            token: response.headers.get('x-access-token')
          })
        })
        const mockStore = configureStore([middleware])
        const data = { token: '1235' }
        const store = mockStore({ session: { data } })
        const updateAction = updateSession({ token: '6789' })

        await store.dispatch(fetchAction('https://test.com'))

        expect(store.getActions()).toEqual(
          expect.arrayContaining([updateAction])
        )
      })

      it('does not dispatch when returning null', async () => {
        fetch.mockResponse(JSON.stringify({ ok: true }), {
          headers: {
            'x-access-token': '6789'
          }
        })
        const middleware = createAuthMiddleware({
          storage,
          authenticator: successAuthenticator,
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

    describe('when request succeeds', () => {
      it('does not dispatch invalidate action', async () => {
        fetch.mockResponse(JSON.stringify({ ok: true }))
        const middleware = configureMiddleware()
        const mockStore = configureStore([middleware])
        const data = { token: '1235' }
        const store = mockStore({ session: { data } })
        const invalidateAction = invalidateSession()

        await store.dispatch(fetchAction('https://test.com'))

        expect(store.getActions()).not.toEqual(
          expect.arrayContaining([invalidateAction])
        )
      })
    })

    describe('when request returns 401 unauthorized', () => {
      it('calls authenticators invalidate', async () => {
        fetch.mockResponse(JSON.stringify({ ok: true }), { status: 401 })
        const middleware = configureMiddleware(spiedAuthenticator)
        const mockStore = configureStore([middleware])
        const data = { token: '1235' }
        const store = mockStore({
          session: { data, isAuthenticated: true, authenticator: 'test' }
        })

        await store.dispatch(fetchAction('https://test.com'))

        expect(spiedAuthenticator.invalidate).toHaveBeenCalledWith(data)

        spiedAuthenticator.authenticate.mockClear()
        spiedAuthenticator.invalidate.mockClear()
      })

      it('does not dispatch if not authenticated', async () => {
        fetch.mockResponse(JSON.stringify({ ok: true }), { status: 401 })
        const middleware = configureMiddleware()
        const mockStore = configureStore([middleware])
        const data = { token: '1235' }
        const store = mockStore({ session: { data, isAuthenticated: false } })
        const invalidateAction = invalidateSession()

        await store.dispatch(fetchAction('https://test.com'))

        expect(store.getActions()).not.toEqual(
          expect.arrayContaining([invalidateAction])
        )
      })
    })
  })
})
