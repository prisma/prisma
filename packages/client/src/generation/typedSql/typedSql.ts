import { DMMF, SqlQueryOutput } from '@prisma/generator-helper'

import { FileMap } from '../generateClient'
import { buildIndexCjs, buildIndexTs } from './buildIndex'
import { buildTypedQueryCjs, buildTypedQueryEsm, buildTypedQueryTs } from './buildTypedQuery'

type TypeSqlBuildOptions = {
  runtimeBase: string
  mainRuntimeName: string
  dmmf: DMMF.Document
  queries: SqlQueryOutput[]
}

export function buildTypedSql({ queries, runtimeBase, mainRuntimeName }: TypeSqlBuildOptions): FileMap {
  const fileMap = {}
  for (const query of queries) {
    const options = { query, runtimeBase, runtimeName: mainRuntimeName }
    fileMap[`${query.name}.d.ts`] = buildTypedQueryTs(options)
    fileMap[`${query.name}.js`] = buildTypedQueryCjs(options)
    fileMap[`${query.name}.mjs`] = buildTypedQueryEsm(options)
  }
  fileMap['index.d.ts'] = buildIndexTs(queries)
  fileMap['index.js'] = buildIndexCjs(queries)
  return fileMap
}
