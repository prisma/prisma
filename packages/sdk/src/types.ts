import type { ConnectorType } from '@prisma/generator-helper'

export interface DatabaseCredentials {
  type: ConnectorType
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
  socket?: string
  extraFields?: { [key: string]: string }
}
