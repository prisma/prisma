import path from 'node:path'

import { defaultTestConfig, type PrismaConfigInternal } from '@prisma/config'

import { getTestSuiteSchemaPath, type NamedTestSuiteConfig, type TestSuiteMeta } from './getTestSuiteInfo'
import type { DatasourceInfo } from './setupTestSuiteEnv'

export function buildPrismaConfig({
  suiteMeta,
  suiteConfig,
  datasourceInfo,
}: {
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
}): PrismaConfigInternal {
  const schemaPath = getTestSuiteSchemaPath({ suiteMeta, suiteConfig })
  return buildPrismaConfigInternal(schemaPath, datasourceInfo.databaseUrl)
}

function buildPrismaConfigInternal(schemaPath: string, databaseUrl: string): PrismaConfigInternal {
  return {
    ...defaultTestConfig(),
    schema: schemaPath,
    datasource: {
      url: absolutizeSqliteUrl({ schemaPath, databaseUrl }),
    },
  }
}

const FILE_PROTOCOL = 'file:'

function absolutizeSqliteUrl({ databaseUrl, schemaPath }: { databaseUrl: string; schemaPath: string }): string {
  if (!databaseUrl.startsWith(FILE_PROTOCOL)) {
    return databaseUrl
  }
  const relativePath = databaseUrl.slice(FILE_PROTOCOL.length)
  const absolutePath = path.resolve(path.dirname(schemaPath), relativePath)
  return FILE_PROTOCOL + absolutePath
}
