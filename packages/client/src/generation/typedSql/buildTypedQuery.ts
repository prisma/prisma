import type { SqlQueryOutput } from '@prisma/generator-helper'

import * as ts from '../ts-builders'
import { Writer } from '../ts-builders/Writer'
import { type DbEnumsList, queryUsesEnums } from './buildDbEnums'
import { getInputType, getOutputType } from './mapTypes'

type BuildTypedQueryOptions = {
  runtimeBase: string
  runtimeName: string
  query: SqlQueryOutput
  enums: DbEnumsList
}

export function buildTypedQueryTs({ query, runtimeBase, runtimeName, enums }: BuildTypedQueryOptions) {
  const file = ts.file()

  file.addImport(ts.moduleImport(`${runtimeBase}/${runtimeName}`).asNamespace('$runtime'))
  if (queryUsesEnums(query, enums)) {
    file.addImport(ts.moduleImport('./$DbEnums').named('$DbEnums'))
  }

  const doc = ts.docComment(query.documentation ?? undefined)
  const factoryType = ts.functionType()
  const parametersType = ts.tupleType()

  for (const param of query.parameters) {
    const paramType = getInputType(param.typ, param.nullable, enums)
    factoryType.addParameter(ts.parameter(param.name, paramType))
    parametersType.add(ts.tupleItem(paramType).setName(param.name))
    if (param.documentation) {
      doc.addText(`@param ${param.name} ${param.documentation}`)
    } else {
      doc.addText(`@param ${param.name}`)
    }
  }
  factoryType.setReturnType(
    ts
      .namedType('$runtime.TypedSql')
      .addGenericArgument(ts.namedType(`${query.name}.Parameters`))
      .addGenericArgument(ts.namedType(`${query.name}.Result`)),
  )
  file.add(ts.moduleExport(ts.constDeclaration(query.name, factoryType)).setDocComment(doc))

  const namespace = ts.namespace(query.name)
  namespace.add(ts.moduleExport(ts.typeDeclaration('Parameters', parametersType)))
  namespace.add(buildResultType(query, enums))
  file.add(ts.moduleExport(namespace))
  return ts.stringify(file)
}

function buildResultType(query: SqlQueryOutput, enums: DbEnumsList) {
  const type = ts
    .objectType()
    .addMultiple(
      query.resultColumns.map((column) => ts.property(column.name, getOutputType(column.typ, column.nullable, enums))),
    )
  return ts.moduleExport(ts.typeDeclaration('Result', type))
}

export function buildTypedQueryCjs({ query, runtimeBase, runtimeName }: BuildTypedQueryOptions) {
  const writer = new Writer(0, undefined)
  writer.writeLine('"use strict"')
  writer.writeLine(`const { makeTypedQueryFactory: $mkFactory } = require("${runtimeBase}/${runtimeName}")`)
  // https://github.com/javascript-compiler-hints/compiler-notations-spec/blob/main/pure-notation-spec.md
  writer.writeLine(`exports.${query.name} = /*#__PURE__*/ $mkFactory(${JSON.stringify(query.source)})`)
  return writer.toString()
}

export function buildTypedQueryEsm({ query, runtimeBase, runtimeName }: BuildTypedQueryOptions) {
  const writer = new Writer(0, undefined)
  writer.writeLine(`import { makeTypedQueryFactory as $mkFactory } from "${runtimeBase}/${runtimeName}"`)
  // https://github.com/javascript-compiler-hints/compiler-notations-spec/blob/main/pure-notation-spec.md
  writer.writeLine(`export const ${query.name} = /*#__PURE__*/ $mkFactory(${JSON.stringify(query.source)})`)
  return writer.toString()
}
