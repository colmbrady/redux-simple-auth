import { createAuthenticator } from '../../src'

export const spiedAuthenticator = createAuthenticator({
  name: 'test',
  authenticate: jest.fn(data => Promise.resolve(data)),
  restore: jest.fn(() => Promise.resolve()),
  invalidate: jest.fn(data => Promise.resolve(data))
})

export const testAuthenticator = createAuthenticator({
  name: 'test',
  authenticate: () => Promise.resolve({ token: 'abcdefg' }),
  restore: () => Promise.resolve(),
  invalidate: () => Promise.resolve()
})
