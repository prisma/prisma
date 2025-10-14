import * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'
import { beforeEach, describe, expect, test } from 'vitest'

import { DMMFHelper } from '../dmmf'
import { buildModelOutputProperty } from './Output'

describe('buildModelOutputProperty', () => {
  let dmmf: DMMFHelper

  beforeEach(() => {
    dmmf = { isComposite: () => false } as DMMFHelper
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

    const property = buildModelOutputProperty(field, dmmf)

    expect(property.isOptional).toBe(true)
    expect(ts.stringify(property.type)).toEqual('string | null')
  })
})
