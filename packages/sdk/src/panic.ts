export class RustPanic extends Error {
  public request: any
  public rustStack: string
  public area: ErrorArea
  public schemaPath?: string
  public schema?: string
  public introspectionUrl?: string
  constructor(
    message: string,
    rustStack: string,
    request: any,
    area: ErrorArea,
    schemaPath?: string,
    schema?: string,
    introspectionUrl?: string,
  ) {
    super(message)
    this.rustStack = rustStack
    this.request = request
    this.area = area
    this.schemaPath = schemaPath
    this.schema = schema
    this.introspectionUrl = introspectionUrl
  }
}

export enum ErrorArea {
  LIFT_CLI = 'LIFT_CLI',
  PHOTON_STUDIO = 'PHOTON_STUDIO',
  INTROSPECTION_CLI = 'INTROSPECTION_CLI',
  FMT_CLI = 'FMT_CLI',
  QUERY_CLI = 'QUERY_CLI',
}
