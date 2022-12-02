import { T } from 'ts-toolbelt'

import { applyFieldsProxy } from './applyFieldsProxy'

const fields = applyFieldsProxy({
  name: 'MyModel',
  dbName: '',
  fields: [
    {
      name: 'intField',
      kind: 'scalar',
      type: 'Int',
      isRequired: true,
      isList: false,
      isId: false,
      isUnique: false,
      isReadOnly: false,
      hasDefaultValue: false,
    },

    {
      name: 'listField',
      kind: 'scalar',
      type: 'String',
      isRequired: true,
      isList: true,
      isId: false,
      isUnique: false,
      isReadOnly: false,
      hasDefaultValue: false,
    },
    {
      name: 'relationField',
      kind: 'scalar',
      type: 'String',
      isRequired: true,
      isList: false,
      isId: false,
      isUnique: false,
      isReadOnly: false,
      hasDefaultValue: false,
      relationName: 'ModelToOtherModel',
    },
  ],
  uniqueFields: [],
  uniqueIndexes: [],
  primaryKey: null,
})

test('returns info about scalar model field', () => {
  expect(fields.intField.name).toBe('intField')
  expect(fields.intField.modelName).toBe('MyModel')
  expect(fields.intField.isList).toBe(false)
  expect(fields.intField.typeName).toBe('Int')

  expect(fields.listField.name).toBe('listField')
  expect(fields.listField.modelName).toBe('MyModel')
  expect(fields.listField.isList).toBe(true)
  expect(fields.listField.typeName).toBe('String')
})

test('does not return relationship info', () => {
  expect(fields.relationField).toBeUndefined()
})

test('returns keys', () => {
  expect(Object.keys(fields)).toEqual(['intField', 'listField'])
})

test('returns values', () => {
  expect(Object.values(fields)).toMatchInlineSnapshot(`
    [
      FieldRefImpl {
        isList: false,
        modelName: MyModel,
        name: intField,
        typeName: Int,
      },
      FieldRefImpl {
        isList: true,
        modelName: MyModel,
        name: listField,
        typeName: String,
      },
    ]
  `)
})
