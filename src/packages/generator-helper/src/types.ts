import { DMMF } from './dmmf'

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
  output: string | null
  isCustomOutput?: boolean
  provider: string
  config: Dictionary<string>
  binaryTargets: string[] // check if new commit is there
  previewFeatures: string[]
}

export interface EnvValue {
  fromEnvVar: null | string
  value: string
}

export type ConnectorType =
  | 'mysql'
  | 'mongo'
  | 'sqlite'
  | 'postgresql'
  | 'sqlserver'

export interface DataSource {
  name: string
  activeProvider: ConnectorType
  provider: ConnectorType[]
  url: EnvValue
  config: { [key: string]: string }
}

export type BinaryPaths = {
  migrationEngine?: { [binaryTarget: string]: string } // key: target, value: path
  queryEngine?: { [binaryTarget: string]: string }
  introspectionEngine?: { [binaryTarget: string]: string }
  prismaFmt?: { [binaryTarget: string]: string }
}

export type GeneratorOptions = {
  generator: GeneratorConfig
  otherGenerators: GeneratorConfig[]
  schemaPath: string
  dmmf: DMMF.Document
  datasources: DataSource[]
  datamodel: string
  binaryPaths?: BinaryPaths
  version: string // version hash
}

export type EngineType =
  | 'queryEngine'
  | 'migrationEngine'
  | 'introspectionEngine'
  | 'prismaFmt'

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
