import type * as DMMF from '@prisma/dmmf'
import { SqlQueryOutput } from '@prisma/generator'

import { FileNameMapper } from '../file-extensions'
import { FileMap } from '../generateClient'
import type { RuntimeName } from '../TSClient/TSClient'
import { buildDbEnums, DbEnumsList } from './buildDbEnums'
import { buildIndex } from './buildIndex'
import { buildTypedQuery } from './buildTypedQuery'

type TypeSqlBuildOptions = {
  runtimeBase: string
  runtimeName: RuntimeName
  dmmf: DMMF.Document
  queries: SqlQueryOutput[]
  outputName: FileNameMapper
  importName: FileNameMapper
}

export function buildTypedSql({
  queries,
  runtimeBase,
  runtimeName,
  dmmf,
  outputName,
  importName,
}: TypeSqlBuildOptions): FileMap {
  const fileMap: FileMap = {
    sql: {},
  }

  const enums = new DbEnumsList(dmmf.datamodel.enums)
  if (!enums.isEmpty()) {
    fileMap.sql[outputName('$DbEnums')] = buildDbEnums(enums)
  }

  for (const query of queries) {
    const options = { query, runtimeBase, runtimeName, enums, importName }
    fileMap.sql[outputName(query.name)] = buildTypedQuery(options)
  }

  fileMap[outputName('sql')] = buildIndex({ queries, enums, importName })

  return fileMap
}
