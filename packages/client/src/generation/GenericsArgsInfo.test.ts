import { DMMF } from '@prisma/generator-helper'

import { GenericArgsInfo } from './GenericsArgsInfo'

function inputObjectType(name: string, fields: DMMF.SchemaArg[], meta?: { source: string }): DMMF.SchemaArgInputType {
  return {
    location: 'inputObjectTypes',
    isList: false,
    type: {
      name,
      fields,
      meta,
      constraints: { minNumFields: null, maxNumFields: null },
    },
  }
}

function field(name: string, inputTypes: DMMF.SchemaArgInputType[]): DMMF.SchemaArg {
  return {
    name,
    isRequired: false,
    isNullable: false,
    inputTypes,
  }
}

function scalar(type: string): DMMF.SchemaArgInputType {
  return {
    location: 'scalar',
    type,
    isList: false,
  }
}

function fieldRef(name: string): DMMF.SchemaArgInputType {
  return {
    location: 'fieldRefTypes',
    type: name,
    isList: false,
  }
}

describe('needsGenericModelArg', () => {
  test('is true for field ref', () => {
    const argsInfo = new GenericArgsInfo()
    expect(argsInfo.needsGenericModelArg(fieldRef('IntRef'))).toBe(true)
  })

  test('is false for object that does not contain field refs', () => {
    const argsInfo = new GenericArgsInfo()
    expect(
      argsInfo.needsGenericModelArg(
        inputObjectType('InputType', [field('someField', [scalar('Int')]), field('someOtherField', [scalar('Int')])]),
      ),
    ).toBe(false)
  })

  test('is true for object that contains field refs', () => {
    const argsInfo = new GenericArgsInfo()
    expect(
      argsInfo.needsGenericModelArg(
        inputObjectType('InputType', [
          field('someField', [scalar('Int')]),
          field('someOtherField', [fieldRef('IntRef')]),
        ]),
      ),
    ).toBe(true)
  })

  test('is false if object containing nested field has source defined', () => {
    const argsInfo = new GenericArgsInfo()
    expect(
      argsInfo.needsGenericModelArg(
        inputObjectType(
          'InputType',
          [field('someField', [scalar('Int')]), field('someOtherField', [fieldRef('IntRef')])],
          { source: 'SomeModel' },
        ),
      ),
    ).toBe(false)
  })

  test('is true for object that contains deeply nested field ref', () => {
    const argsInfo = new GenericArgsInfo()
    expect(
      argsInfo.needsGenericModelArg(
        inputObjectType('InputType', [
          field('someField', [scalar('Int')]),
          field('someOtherField', [
            inputObjectType('Input2', [
              field('field', [inputObjectType('Input3', [field('refField', [fieldRef('IntRef')])])]),
            ]),
          ]),
        ]),
      ),
    ).toBe(true)
  })

  test('types with recursion does not require generic if no other field does', () => {
    const argsInfo = new GenericArgsInfo()
    const type = inputObjectType('RecursiveType', [])

    ;(type.type as DMMF.InputType).fields.push(field('recursiveField', [type]))
    ;(type.type as DMMF.InputType).fields.push(field('otherField', [scalar('Int')]))

    expect(argsInfo.needsGenericModelArg(type)).toBe(false)
  })

  test('types with recursion require generic if any other field does', () => {
    const argsInfo = new GenericArgsInfo()
    const type = inputObjectType('RecursiveType', [])

    ;(type.type as DMMF.InputType).fields.push(field('recursiveField', [type]))
    ;(type.type as DMMF.InputType).fields.push(field('otherField', [fieldRef('IntRef')]))

    expect(argsInfo.needsGenericModelArg(type)).toBe(true)
  })
})
