import { assertAlways, type MultipleSchemas } from '@prisma/internals'

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
  const lines = content.split(/\r\n|\r|\n/g)
  const existingDatasource = findDatasource(lines)
  if (!existingDatasource) {
    return { replaced: false, content }
  }
  lines.splice(existingDatasource.startLine, existingDatasource.endLine - existingDatasource.startLine + 1)
  const noDatasource = lines.join('\n').trim()

  return { replaced: true, content: `${newDatasource}\n\n${noDatasource}` }
}

type Position = {
  startLine: number
  endLine: number
}

function findDatasource(lines: string[]): Position | undefined {
  if (lines.length <= 2) {
    return undefined
  }
  const startLine = lines.findIndex((line) => {
    const lineTrimmed = line.trim()
    return lineTrimmed.startsWith('datasource') && lineTrimmed.endsWith('{')
  })

  if (startLine === -1) {
    return undefined
  }

  let endLine = -1
  for (let index = startLine; index < lines.length; index++) {
    const lineTrimmed = lines[index].trim()
    if (lineTrimmed.endsWith('}') && !lineTrimmed.startsWith('//')) {
      endLine = index
      break
    }
  }
  if (endLine === -1) {
    return undefined
  }

  return { startLine, endLine }
}
