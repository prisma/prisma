import { SqlQueryOutput } from '@prisma/generator-helper'

import * as ts from '../ts-builders'
import { Writer } from '../ts-builders/Writer'
import { DbEnumsList } from './buildDbEnums'

export function buildIndexTs(queries: SqlQueryOutput[], enums: DbEnumsList) {
  const file = ts.file()
  if (!enums.isEmpty()) {
    file.add(ts.moduleExportFrom('./$DbEnums').asNamespace('$DbEnums'))
  }
  for (const query of queries) {
    file.add(ts.moduleExportFrom(`./${query.name}`))
  }
  return ts.stringify(file)
}

export function buildIndexCjs(queries: SqlQueryOutput[], edge: boolean) {
  const writer = new Writer(0, undefined)
  writer.writeLine('"use strict"')
  for (const { name } of queries) {
    const fileName = edge ? `${name}.edge` : name
    writer.writeLine(`exports.${name} = require("./${fileName}.js").${name}`)
  }
  return writer.toString()
}

export function buildIndexEsm(queries: SqlQueryOutput[], edge: boolean) {
  const writer = new Writer(0, undefined)
  for (const { name } of queries) {
    const fileName = edge ? `${name}.edge` : name
    writer.writeLine(`export * from "./${fileName}.mjs"`)
  }
  return writer.toString()
}
