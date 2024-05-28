import { MultipleSchemas } from '@prisma/internals'

import { removeDatasource } from './removeDatasource'

export function replaceDatasource(newDatasource: string, files: MultipleSchemas): MultipleSchemas {
  return files.map(([path, content]) => [path, replaceDatasourceSingle(newDatasource, content)])
}

function replaceDatasourceSingle(newDatasource: string, content: string) {
  const noDatasource = removeDatasource(content)
  if (content === noDatasource) {
    // no datasource in this file
    return content
  }

  return `${newDatasource}\n${noDatasource}`
}
