import type * as DMMF from '@prisma/dmmf'
import { SqlQueryOutput } from '@prisma/generator'
import { isValidJsIdentifier } from '@prisma/internals'
import * as ts from '@prisma/ts-builders'

type DbEnum = {
  name: string
  values: string[]
}

export class DbEnumsList {
  readonly enums: DbEnum[]

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
  const iface = ts.interfaceDeclaration('$DbEnums')

  for (const dbEnum of list.enums) {
    iface.add(ts.property(dbEnum.name, enumToUnion(dbEnum)))
  }

  file.add(ts.moduleExport(iface))

  return ts.stringify(file)
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
