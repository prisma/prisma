import type { DMMF, SqlQueryOutput } from '@prisma/generator-helper'
import { isValidJsIdentifier } from '@prisma/internals'

import * as ts from '../ts-builders'

type DbEnum = {
  name: string
  values: string[]
}
export class DbEnumsList {
  private enums: DbEnum[]
  constructor(enums: readonly DMMF.DatamodelEnum[]) {
    this.enums = enums.map((dmmfEnum) => ({
      name: dmmfEnum.dbName ?? dmmfEnum.name,
      values: dmmfEnum.values.map((dmmfValue) => dmmfValue.dbName ?? dmmfValue.name),
    }))
  }

  isEmpty() {
    return this.enums.length === 0
  }

  hasEnum(name: string) {
    return Boolean(this.enums.find((dbEnum) => dbEnum.name === name))
  }

  *validJsIdentifiers() {
    for (const dbEnum of this.enums) {
      if (isValidJsIdentifier(dbEnum.name)) {
        yield dbEnum
      }
    }
  }

  *invalidJsIdentifiers() {
    for (const dbEnum of this.enums) {
      if (!isValidJsIdentifier(dbEnum.name)) {
        yield dbEnum
      }
    }
  }
}

export function buildDbEnums(list: DbEnumsList) {
  const file = ts.file()
  file.add(buildInvalidIdentifierEnums(list))
  file.add(buildValidIdentifierEnums(list))

  return ts.stringify(file)
}

function buildValidIdentifierEnums(list: DbEnumsList) {
  const namespace = ts.namespace('$DbEnums')
  for (const dbEnum of list.validJsIdentifiers()) {
    namespace.add(ts.typeDeclaration(dbEnum.name, enumToUnion(dbEnum)))
  }
  return ts.moduleExport(namespace)
}

function buildInvalidIdentifierEnums(list: DbEnumsList) {
  const iface = ts.interfaceDeclaration('$DbEnums')
  for (const dbEnum of list.invalidJsIdentifiers()) {
    iface.add(ts.property(dbEnum.name, enumToUnion(dbEnum)))
  }
  return ts.moduleExport(iface)
}

function enumToUnion(dbEnum: DbEnum) {
  return ts.unionType(dbEnum.values.map(ts.stringLiteral))
}

export function queryUsesEnums(query: SqlQueryOutput, enums: DbEnumsList): boolean {
  if (enums.isEmpty()) {
    return false
  }
  return (
    query.parameters.some((param) => enums.hasEnum(param.typ)) ||
    query.resultColumns.some((column) => enums.hasEnum(column.typ))
  )
}
