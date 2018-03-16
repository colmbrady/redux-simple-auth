import invariant from 'invariant'
import { Authenticator } from './types'

interface options {
  name: string
  restore?: () => Promise<any>
  authenticate?: () => Promise<any>
  invalidate?: (data: any) => Promise<any>
}

export default ({
  name,
  restore = () => Promise.reject(null),
  authenticate = () => Promise.reject(null),
  invalidate = (data: any) => Promise.resolve(data)
}: options): Authenticator => {
  invariant(name != null, 'Authenticators must define a `name` property')

  invariant(
    typeof name === 'string',
    'Expected the `name` property of the authenticator to be a string'
  )

  return {
    name,
    restore,
    authenticate,
    invalidate
  }
}
