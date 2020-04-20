import { DatabaseCredentials } from '@prisma/sdk'

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
