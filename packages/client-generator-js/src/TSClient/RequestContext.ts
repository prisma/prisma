import { Generable } from './Generable'

export class RequestContext implements Generable {
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
