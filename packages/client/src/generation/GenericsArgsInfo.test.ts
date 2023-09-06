import { DMMF } from '@prisma/generator-helper'

import { DMMFHelper } from './dmmf'
import { GenericArgsInfo } from './GenericsArgsInfo'

function inputObjectType(name: string, fields: DMMF.SchemaArg[], meta?: { source: string }): DMMF.InputType {
  return {
    name,
    fields,
    meta,
    constraints: { minNumFields: null, maxNumFields: null },
  }
}

function inputObjectRef(name: string): DMMF.InputTypeRef {
  return {
    location: 'inputObjectTypes',
    namespace: 'prisma',
    isList: false,
    type: name,
  }
}

function field(name: string, inputTypes: DMMF.InputTypeRef[]): DMMF.SchemaArg {
  return {
    name,
    isRequired: false,
    isNullable: false,
    inputTypes,
  }
}

function scalarRef(type: string): DMMF.InputTypeRef {
  return {
    location: 'scalar',
    type,
    isList: false,
  }
}

function fieldRef(name: string): DMMF.InputTypeRef {
  return {
    location: 'fieldRefTypes',
    type: name,
    isList: false,
  }
}

function dmmf(inputObjectTypes: DMMF.InputType[]) {
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
      models: [],
      types: [],
      enums: [],
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

describe('typeNeedsGenericModelArg', () => {
  test('is false for object that does not contain field refs', () => {
    const object = inputObjectType('InputType', [
      field('someField', [scalarRef('Int')]),
      field('someOtherField', [scalarRef('Int')]),
    ])

    const argsInfo = new GenericArgsInfo(dmmf([]))
    expect(argsInfo.typeNeedsGenericModelArg(object)).toBe(false)
  })

  test('is true for object that contains field refs', () => {
    const argsInfo = new GenericArgsInfo(dmmf([]))
    expect(
      argsInfo.typeNeedsGenericModelArg(
        inputObjectType('InputType', [
          field('someField', [scalarRef('Int')]),
          field('someOtherField', [fieldRef('IntRef')]),
        ]),
      ),
    ).toBe(true)
  })

  test('is false if object containing nested field has source defined', () => {
    const argsInfo = new GenericArgsInfo(dmmf([]))
    expect(
      argsInfo.typeNeedsGenericModelArg(
        inputObjectType(
          'InputType',
          [field('someField', [scalarRef('Int')]), field('someOtherField', [fieldRef('IntRef')])],
          { source: 'SomeModel' },
        ),
      ),
    ).toBe(false)
  })

  test('is true for object that contains deeply nested field ref', () => {
    const input1 = inputObjectType('Input1', [
      field('someField', [scalarRef('Int')]),
      field('someOtherField', [inputObjectRef('Input2')]),
    ])

    const input2 = inputObjectType('Input2', [field('thirdField', [inputObjectRef('Input3')])])
    const input3 = inputObjectType('Input3', [field('refField', [fieldRef('IntRef')])])
    const argsInfo = new GenericArgsInfo(dmmf([input1, input2, input3]))
    expect(argsInfo.typeNeedsGenericModelArg(input1)).toBe(true)
  })

  test('types with recursion does not require generic if no other field does', () => {
    const type = inputObjectType('RecursiveType', [
      field('recursiveField', [inputObjectRef('RecursiveType')]),
      field('otherField', [scalarRef('Int')]),
    ])
    const argsInfo = new GenericArgsInfo(dmmf([type]))

    expect(argsInfo.typeNeedsGenericModelArg(type)).toBe(false)
  })

  test('types with recursion require generic if any other field does', () => {
    const type = inputObjectType('RecursiveType', [
      field('recursiveField', [inputObjectRef('RecursiveType')]),
      field('otherField', [fieldRef('IntRef')]),
    ])
    const argsInfo = new GenericArgsInfo(dmmf([type]))

    expect(argsInfo.typeNeedsGenericModelArg(type)).toBe(true)
  })
})

describe('typeRefNeedsGenericModelArg', () => {
  test('is true for field ref', () => {
    const argsInfo = new GenericArgsInfo(dmmf([]))
    expect(argsInfo.typeRefNeedsGenericModelArg(fieldRef('IntRef'))).toBe(true)
  })

  test('is true if referenced type has field refs', () => {
    const type = inputObjectType('Input', [
      field('someField', [scalarRef('Int')]),
      field('refField', [fieldRef('IntRef')]),
    ])

    const argsInfo = new GenericArgsInfo(dmmf([type]))
    expect(argsInfo.typeRefNeedsGenericModelArg(inputObjectRef('Input'))).toBe(true)
  })

  test('is false if referenced type has no field refs', () => {
    const type = inputObjectType('Input', [field('someField', [scalarRef('Int')])])

    const argsInfo = new GenericArgsInfo(dmmf([type]))
    expect(argsInfo.typeRefNeedsGenericModelArg(inputObjectRef('Input'))).toBe(false)
  })
})
