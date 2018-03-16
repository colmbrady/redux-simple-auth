export type Authenticator = {
  name: string
  restore: Promise<any>
  authenticate: Promise<any>
  invalidate: Promise<any>
}
