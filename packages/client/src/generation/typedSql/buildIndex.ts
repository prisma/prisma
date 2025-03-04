import type { SqlQueryOutput } from '@prisma/generator-helper'

import * as ts from '../ts-builders'
import { Writer } from '../ts-builders/Writer'
import type { DbEnumsList } from './buildDbEnums'

export function buildIndexTs(queries: SqlQueryOutput[], enums: DbEnumsList) {
  const file = ts.file()
  if (!enums.isEmpty()) {
    file.add(ts.moduleExportFrom('./$DbEnums').named('$DbEnums'))
  }
  for (const query of queries) {
    file.add(ts.moduleExportFrom(`./${query.name}`))
  }
  return ts.stringify(file)
}

export function buildIndexCjs(queries: SqlQueryOutput[], edgeRuntimeSuffix?: 'wasm' | 'edge' | undefined) {
  const writer = new Writer(0, undefined)
  writer.writeLine('"use strict"')
  for (const { name } of queries) {
    const fileName = edgeRuntimeSuffix ? `${name}.${edgeRuntimeSuffix}` : name
    writer.writeLine(`exports.${name} = require("./${fileName}.js").${name}`)
  }
  return writer.toString()
}

export function buildIndexEsm(queries: SqlQueryOutput[], edgeRuntimeSuffix?: 'wasm' | 'edge' | undefined) {
  const writer = new Writer(0, undefined)
  for (const { name } of queries) {
    const fileName = edgeRuntimeSuffix ? `${name}.${edgeRuntimeSuffix}` : name
    writer.writeLine(`export * from "./${fileName}.mjs"`)
  }
  return writer.toString()
}
