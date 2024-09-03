import { DMMF, SqlQueryOutput } from '@prisma/generator-helper'

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

  *[Symbol.iterator]() {
    for (const dbEnum of this.enums) {
      yield dbEnum
    }
  }
}

export function buildDbEnums(list: DbEnumsList) {
  const file = ts.file()
  for (const dbEntry of list) {
    file.add(buildDbEnum(dbEntry))
  }

  return ts.stringify(file)
}

function buildDbEnum(dbEnum: DbEnum) {
  const type = ts.unionType(dbEnum.values.map(ts.stringLiteral))
  return ts.moduleExport(ts.typeDeclaration(dbEnum.name, type))
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
