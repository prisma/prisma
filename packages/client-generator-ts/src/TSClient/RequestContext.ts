export class RequestContext {
  constructor() {}
  public toTS(): string {
    return `export type DynamicSchema = { from: string; to: string }
export type RequestContextPayload = {
  dynamicSchemas?: DynamicSchema[]
}
export type RequestContext = AsyncLocalStorage<RequestContextPayload>
`
  }
}
