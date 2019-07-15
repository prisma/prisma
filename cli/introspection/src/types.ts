import { DatabaseType } from 'prisma-datamodel'
import { DatabaseMetadata } from 'prisma-db-introspection/dist/common/introspectionResult'

export interface DatabaseCredentials {
  type: DatabaseType
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  alreadyData?: boolean
  schema?: string
  newSchema?: string
  ssl?: boolean
  uri?: string
  executeRaw?: boolean
}

export interface IntrospectionResult {
  sdl: string
  numTables: number
  referenceDatamodelExists: boolean
  time: number
  credentials: DatabaseCredentials
  databaseName: string
}

export interface SchemaWithMetadata {
  name: string
  metadata: DatabaseMetadata
}

export type PromptType = 'init' | 'introspect'

// TODO: Bad interface naming :(
export interface InitConfiguration {
  databaseType: DatabaseType
  lift: boolean
  photon: boolean
  language: 'TypeScript' | 'JavaScript'
  template: 'from_scratch' | 'graphql_boilerplate' | 'rest_boilerplate' | 'grpc_boilerplate'
}

export interface InitPromptResult {
  introspectionResult: IntrospectionResult
  initConfiguration: InitConfiguration
}
