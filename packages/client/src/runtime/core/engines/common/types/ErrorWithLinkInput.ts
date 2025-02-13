import type { ConnectorType } from '@prisma/generator-helper'

export interface ErrorWithLinkInput {
  version: string
  engineVersion?: string
  database?: ConnectorType
  query?: string
  binaryTarget?: string
  title: string
  description?: string
}
