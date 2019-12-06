import { DatabaseCredentials } from '@prisma/sdk'
import { ConnectorType } from '@prisma/generator-helper'

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

export interface DatabaseMetadata {
  size_in_bytes: number
  table_count: number
}

export type PromptType = 'init' | 'introspect'

// TODO: Bad interface naming :(
export interface InitConfiguration {
  databaseType: ConnectorType
  lift: boolean
  photon: boolean
  language: 'TypeScript' | 'JavaScript'
  template: 'from_scratch' | 'graphql_boilerplate' | 'rest_boilerplate' | 'grpc_boilerplate'
}

export interface InitPromptResult {
  introspectionResult: IntrospectionResult
  initConfiguration: InitConfiguration
}
