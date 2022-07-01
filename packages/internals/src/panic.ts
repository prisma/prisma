import { ExecaError } from 'execa'

export class RustPanic extends Error {
  public readonly __typename = 'RustPanic'
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

export function isRustPanic(e: Error): e is RustPanic {
  return (e as RustPanic).__typename === 'RustPanic'
}

export enum ErrorArea {
  LIFT_CLI = 'LIFT_CLI',
  // Looks unused, could probably be removed
  PHOTON_STUDIO = 'PHOTON_STUDIO',
  INTROSPECTION_CLI = 'INTROSPECTION_CLI',
  FMT_CLI = 'FMT_CLI',
  QUERY_ENGINE_BINARY_CLI = 'QUERY_ENGINE_BINARY_CLI',
  QUERY_ENGINE_LIBRARY_CLI = 'QUERY_ENGINE_LIBRARY_CLI',
}

/**
 * @param error error thrown by execa
 * @returns true if the given error is caused by a panic on a Rust engine.
 */
export function isExecaErrorCausedByRustPanic<E extends ExecaError>(error: E) {
  return error.exitCode === 101 || error.stderr?.includes('panicked at')
}
