import { SqlQueryOutput } from '@prisma/generator'
import * as ts from '@prisma/ts-builders'

import { FileNameMapper } from '../file-extensions'
import { DbEnumsList } from './buildDbEnums'

type BuildIndexOptions = {
  queries: SqlQueryOutput[]
  enums: DbEnumsList
  importName: FileNameMapper
}

export function buildIndex({ queries, enums, importName }: BuildIndexOptions) {
  const file = ts.file()
  if (!enums.isEmpty()) {
    file.add(ts.moduleExportFrom(importName('./sql/$DbEnums')).named(ts.namedExport('$DbEnums').typeOnly()))
  }
  for (const query of queries) {
    file.add(ts.moduleExportFrom(importName(`./sql/${query.name}`)))
  }
  return ts.stringify(file)
}
