export type Authenticator = {
  name: string
  restore: (data: any) => Promise<any>
  authenticate: (data: any) => Promise<any>
  invalidate: (data: any) => Promise<any>
}
