import { DMMF } from '@prisma/generator-helper'

import { dmmfToRuntimeDataModel, RuntimeDataModel } from '../runtime/core/runtimeDataModel'

export function field(kind: DMMF.FieldKind, name: string, type: string, extra?: Partial<DMMF.Field>): DMMF.Field {
  return {
    kind,
    name,
    type,
    isRequired: false,
    isList: false,
    isUnique: true,
    isId: true,
    isReadOnly: false,
    hasDefaultValue: false,
    ...extra,
  }
}

export function model(name: string, fields: DMMF.Field[]): DMMF.Model {
  return {
    name,
    dbName: null,
    fields: [
      field('scalar', 'id', 'String', {
        isUnique: true,
        isId: true,
      }),
      ...fields,
    ],
    uniqueFields: [],
    uniqueIndexes: [],
    primaryKey: {
      name: 'id',
      fields: ['id'],
    },
  }
}

export function runtimeDataModel({ models }: { models: DMMF.Model[] }): RuntimeDataModel {
  return dmmfToRuntimeDataModel({
    models,
    enums: [],
    types: [],
  })
}
