import type { SqlQueryOutput } from '@prisma/generator-helper'
import { type ConfigMetaFormat, getConfig, getEffectiveUrl, getSchemaWithPath } from '@prisma/internals'

import { SchemaEngine } from '../SchemaEngine'
import type { EngineArgs } from '../types'

const supportedProviders = ['postgresql', 'cockroachdb', 'mysql', 'sqlite']

export interface IntrospectSqlInput extends EngineArgs.SqlQueryInput {
  fileName: string
}

export type IntrospectSqlError = {
  fileName: string
  message: string
}

type IntrospectSingleResult =
  | {
      ok: true
      result: SqlQueryOutput
    }
  | {
      ok: false
      error: IntrospectSqlError
    }

export type IntrospectSqlResult =
  | {
      ok: true
      queries: SqlQueryOutput[]
    }
  | {
      ok: false
      errors: IntrospectSqlError[]
    }

export async function introspectSql(
  schemaPath: string | undefined,
  queries: IntrospectSqlInput[],
): Promise<IntrospectSqlResult> {
  const schema = await getSchemaWithPath(schemaPath)
  const config = await getConfig({ datamodel: schema.schemas })
  if (!supportedProviders.includes(config.datasources?.[0]?.activeProvider)) {
    throw new Error(`Typed SQL is supported only for ${supportedProviders.join(', ')} providers`)
  }
  if (!isTypedSqlEnabled(config)) {
    throw new Error(`\`typedSql\` preview feature needs to be enabled in ${schema.schemaPath}`)
  }

  const firstDatasource = config.datasources[0]
  if (!firstDatasource) {
    throw new Error(`Could not find datasource in schema ${schema.schemaPath}`)
  }
  const url = getEffectiveUrl(firstDatasource).value
  if (!url) {
    throw new Error(`Could not get url from datasource ${firstDatasource.name} in ${schema.schemaPath}`)
  }

  const schemaEngine = new SchemaEngine({ schemaPath: schema.schemaPath })
  const results: SqlQueryOutput[] = []
  const errors: IntrospectSqlError[] = []
  try {
    for (const query of queries) {
      const queryResult = await introspectSingleQuery(schemaEngine, url, query)
      if (queryResult.ok) {
        results.push(queryResult.result)
      } else {
        errors.push(queryResult.error)
      }
    }
  } finally {
    schemaEngine.stop()
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, queries: results }
}

// engine is capabale of introspecting queries as a batch, but we need to map them back to files they defined in, so,
// for now, we sending them in one by one
async function introspectSingleQuery(
  schemaEngine: SchemaEngine,
  url: string,
  query: IntrospectSqlInput,
): Promise<IntrospectSingleResult> {
  try {
    const result = await schemaEngine.introspectSql({
      url,
      queries: [query],
    })
    const queryResult = result.queries[0]
    if (!queryResult) {
      return {
        ok: false,
        error: {
          fileName: query.fileName,
          message: 'Invalid response from schema engine',
        },
      }
    }
    return {
      ok: true,
      result: queryResult,
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        fileName: query.fileName,
        message: String(error),
      },
    }
  }
}

function isTypedSqlEnabled(config: ConfigMetaFormat) {
  return config.generators.some((gen) => gen?.previewFeatures?.includes('typedSql'))
}
