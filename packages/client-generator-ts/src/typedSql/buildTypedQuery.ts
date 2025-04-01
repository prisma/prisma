import { SqlQueryOutput } from '@prisma/generator'
import * as ts from '@prisma/ts-builders'

import { FileNameMapper } from '../file-extensions'
import { DbEnumsList, queryUsesEnums } from './buildDbEnums'
import { getInputType, getOutputType } from './mapTypes'

type BuildTypedQueryOptions = {
  runtimeBase: string
  runtimeName: string
  query: SqlQueryOutput
  enums: DbEnumsList
  importName: FileNameMapper
}

export function buildTypedQuery({ query, runtimeBase, runtimeName, enums, importName }: BuildTypedQueryOptions) {
  const file = ts.file()

  file.addImport(ts.moduleImport(`${runtimeBase}/${runtimeName}`).asNamespace('$runtime'))
  if (queryUsesEnums(query, enums)) {
    file.addImport(ts.moduleImport(importName('./$DbEnums')).named(ts.namedImport('$DbEnums').typeOnly()))
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

  file.add(
    ts
      .moduleExport(
        ts
          .constDeclaration(query.name)
          .setValue(
            ts
              .functionCall('$runtime.makeTypedQueryFactory')
              .addArgument(ts.stringLiteral(query.source).asValue())
              .as(factoryType),
          ),
      )
      .setDocComment(doc),
  )

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
