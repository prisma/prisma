import * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'
import { beforeEach, describe, expect, test } from 'vitest'

import { DMMFHelper } from '../dmmf'
import { buildModelOutputProperty } from './Output'

function dmmf(inputObjectTypes: DMMF.InputType[] = [], models: DMMF.Model[] = []) {
  return new DMMFHelper({
    schema: {
      inputObjectTypes: {
        prisma: inputObjectTypes,
      },
      outputObjectTypes: {
        prisma: [
          { name: 'Query', fields: [] },
          { name: 'Mutation', fields: [] },
        ],
        model: [],
      },
      enumTypes: {
        prisma: [],
      },
      fieldRefTypes: {
        prisma: [],
      },
    },
    datamodel: {
      models: models,
      types: [],
      enums: [],
      indexes: [],
    },

    mappings: {
      modelOperations: [],
      otherOperations: {
        read: [],
        write: [],
      },
    },
  })
}

describe('buildModelOutputProperty', () => {
  let dmmfHelper: DMMFHelper

  beforeEach(() => {
    dmmfHelper = dmmf()
  })

  test('should add optional modifier to non-required fields', () => {
    const field: DMMF.Field = {
      name: 'age',
      kind: 'scalar',
      isList: false,
      isRequired: false,
      isUnique: false,
      isId: false,
      isReadOnly: false,
      type: 'String',
      hasDefaultValue: false,
      relationName: undefined,
      relationFromFields: undefined,
      relationToFields: undefined,
      relationOnDelete: undefined,
      documentation: undefined,
    }

    const property = buildModelOutputProperty(field, dmmfHelper)

    expect(property.isOptional).toBe(true)
    expect(ts.stringify(property.type)).toEqual('string | null')
  })
})
