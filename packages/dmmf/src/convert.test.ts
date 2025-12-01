import { expect, test } from 'vitest'

import { datamodelEnumToSchemaEnum } from './convert'
import { DatamodelEnum } from './dmmf'

test('datamodelEnumToSchemaEnum', () => {
  const datamodelEnum = {
    name: 'Color',
    values: [
      { name: 'Red', dbName: 'red' },
      { name: 'Green', dbName: null },
      { name: 'Blue', dbName: null },
    ],
  } satisfies DatamodelEnum

  const dmmfEnum = datamodelEnumToSchemaEnum(datamodelEnum)

  expect(dmmfEnum).toEqual({
    name: 'Color',
    data: [
      {
        key: 'Red',
        value: 'red',
      },
      {
        key: 'Green',
        value: 'Green',
      },
      {
        key: 'Blue',
        value: 'Blue',
      },
    ],
  })
})
