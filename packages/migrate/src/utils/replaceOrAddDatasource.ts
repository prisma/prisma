import { assertAlways, MultipleSchemas } from '@prisma/internals'

import { removeDatasource } from './removeDatasource'

export function replaceOrAddDatasource(newDatasource: string, files: MultipleSchemas): MultipleSchemas {
  let replaced = false
  const result: MultipleSchemas = files.map(([path, content]) => {
    const replaceResult = replaceDatasourceSingle(newDatasource, content)
    if (replaceResult.replaced) {
      replaced = true
    }
    return [path, replaceResult.content]
  })

  if (!replaced) {
    appendToFirstFile(newDatasource, result)
  }

  return result
}

function appendToFirstFile(newDatasource: string, files: MultipleSchemas) {
  const firstFile = files[0]
  assertAlways(firstFile, 'There always should be at least on file in the schema')

  // [1] = content of the file
  // prepend new datasource to the first file
  firstFile[1] = `${newDatasource}\n${firstFile[1]}`
}

function replaceDatasourceSingle(newDatasource: string, content: string) {
  const noDatasource = removeDatasource(content)
  if (content === noDatasource) {
    // no datasource in this file
    return { replaced: false, content }
  }

  return { replaced: true, content: `${newDatasource}\n${noDatasource.trim()}` }
}
