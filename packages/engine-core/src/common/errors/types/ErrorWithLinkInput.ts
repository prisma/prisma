import type { ConnectorType } from '@prisma/generator-helper'

export interface ErrorWithLinkInput {
  version: string
  engineVersion?: string
  database?: ConnectorType
  query?: string
  platform?: string
  title: string
  description?: string
}
