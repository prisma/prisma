import type { DMMF } from './dmmf'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JsonRPC {
  export type Request = {
    jsonrpc: '2.0'
    method: string
    params?: any
    id: number
  }

  export type Response = SuccessResponse | ErrorResponse

  export type SuccessResponse = {
    jsonrpc: '2.0'
    result: any
    id: number
  }

  export type ErrorResponse = {
    jsonrpc: '2.0'
    error: {
      code: number
      message: string
      data: any
    }
    id: number
  }
}

export type Dictionary<T> = { [key: string]: T }

export interface GeneratorConfig {
  name: string
  output: EnvValue | null
  isCustomOutput?: boolean
  provider: EnvValue
  config: Dictionary<string>
  binaryTargets: BinaryTargetsEnvValue[]
  // TODO why is this not optional?
  previewFeatures: string[]
}

export interface EnvValue {
  fromEnvVar: null | string
  value: null | string
}

export interface BinaryTargetsEnvValue {
  fromEnvVar: null | string
  value: string
}

export type ConnectorType =
  | 'mysql'
  | 'mongodb'
  | 'sqlite'
  | 'postgresql'
  | 'postgres' // TODO: we could normalize postgres to postgresql this in engines to reduce the complexity?
  | 'sqlserver'
  | 'cockroachdb'

  // TODO: this should be removed in favor of `'sqlserver'`, as per `getConfig({ ... }).datasources[0]?.provider` from a schema with `provider = "sqlserver"`
  // 'jdbc:sqlserver' has been removed in https://github.com/prisma/prisma-engines/pull/2830
  | 'jdbc:sqlserver'

export interface DataSource {
  name: string
  provider: ConnectorType
  activeProvider: ConnectorType
  url: EnvValue
  directUrl?: EnvValue
  schemas: string[] | []
}

export type BinaryPaths = {
  migrationEngine?: { [binaryTarget: string]: string } // key: target, value: path
  queryEngine?: { [binaryTarget: string]: string }
  libqueryEngine?: { [binaryTarget: string]: string }
}

/** The options passed to the generator implementations */
export type GeneratorOptions = {
  generator: GeneratorConfig
  // TODO: what is otherGenerators for?
  otherGenerators: GeneratorConfig[]
  schemaPath: string
  dmmf: DMMF.Document
  datasources: DataSource[]
  // TODO deprecate datamodel & rename to schema?
  datamodel: string
  // TODO is it really always version hash? Feature is unclear.
  version: string // version hash
  binaryPaths?: BinaryPaths
  dataProxy: boolean
  postinstall?: boolean
}

export type EngineType = 'queryEngine' | 'libqueryEngine' | 'migrationEngine'

export type GeneratorManifest = {
  prettyName?: string
  defaultOutput?: string
  denylists?: {
    models?: string[]
    fields?: string[]
  }
  requiresGenerators?: string[]
  requiresEngines?: EngineType[]
  version?: string
  requiresEngineVersion?: string
}
