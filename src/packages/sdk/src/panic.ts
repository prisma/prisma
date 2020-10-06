export class RustPanic extends Error {
  public request: any
  public rustStack: string
  public area: ErrorArea
  public schemaPath?: string
  public schema?: string
  public sqlDump?: string
  public dbVersion?: string
  constructor(
    message: string,
    rustStack: string,
    request: any,
    area: ErrorArea,
    schemaPath?: string,
    schema?: string,
    sqlDump?: string,
    dbVersion?: string,
  ) {
    super(message)
    this.rustStack = rustStack
    this.request = request
    this.area = area
    this.schemaPath = schemaPath
    this.schema = schema
    this.sqlDump = sqlDump
    this.dbVersion = dbVersion
  }
}

export enum ErrorArea {
  LIFT_CLI = 'LIFT_CLI',
  PHOTON_STUDIO = 'PHOTON_STUDIO',
  INTROSPECTION_CLI = 'INTROSPECTION_CLI',
}
