import { InputType } from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'

import { GraphQLScalarToJSTypeTable } from '../../utils/common'
import { GenerateContext } from '../GenerateContext'

// const BASE_FILTER_FIELDS = new Set(['lt', 'lte', 'gt', 'gte', 'equals', 'in', 'notIn', 'not'])
const STRING_FILTER_FIELDS = new Set(['startsWith', 'endsWith', 'contains'])
const AGGREGATE_FIELDS = new Set(['_count', '_min', '_max'])

export class InputTypeOptimizer {
  constructor(private readonly context: GenerateContext) {}

  static sharedUtilityTypes() {
    // TODO: use ts builder to create utility types
    return `
type DistributedArray<T> = T extends unknown ? T[] : never

interface BaseFilter<T, Ref, Null> {
  lt?: T | Ref
  lte?: T | Ref
  gt?: T | Ref
  gte?: T | Ref
  equals?: T | Ref | Null
  in?: DistributedArray<T> | Null
  notIn?: DistributedArray<T> | Null
  not?: this | T | Null
}

interface BaseAggregateProps<Model, Null> {
  _count?: Prisma.NestedIntFilter<Model, Null>
  _min?: this
  _max?: this
}

interface StringProps<T, Ref> {
  startsWith?: T | Ref
  endsWith?: T | Ref
  contains?: T | Ref
}
`
  }

  optimize(inputType: InputType) {
    if (!inputType.name.endsWith('Filter')) return
    if (inputType.meta?.grouping) return

    const params = extractParameters(inputType)
    if (!params) return

    if (!validateType(inputType, params)) return

    return buildOptimizedType(inputType, params)
  }
}

type InputTypeParams = NonNullable<ReturnType<typeof extractParameters>>

function extractParameters(inputType: InputType) {
  const inField = inputType.fields.find((field) => field.name === 'in')
  if (!inField) return
  const inType = inField.inputTypes.at(0)
  if (!inType) return
  const baseType = inType.type
  const jsBaseType = getJsType(baseType)
  if (!jsBaseType) return

  const equalsField = inputType.fields.find((field) => field.name === 'equals')
  if (!equalsField) return
  const refType = equalsField.inputTypes.find((type) => type.type !== baseType)
  if (!refType) return
  const refTypeName = refType.namespace === 'prisma' ? `Prisma.${refType.type}` : refType.type

  return {
    baseType: jsBaseType,
    refType: refTypeName,
    isNullable: inField.isNullable,
    hasStringProps: inputType.fields.some((field) => STRING_FILTER_FIELDS.has(field.name)),
    hasAggregates: inputType.fields.some((field) => AGGREGATE_FIELDS.has(field.name)),
  }
}

function getJsType(type: string) {
  const scalarType = GraphQLScalarToJSTypeTable[type]
  if (!scalarType) return

  if (Array.isArray(scalarType)) {
    return ts.unionType(scalarType.map((t) => ts.namedType(t)))
  } else {
    return ts.namedType(scalarType)
  }
}

function validateType(_inputType: InputType, _params: InputTypeParams) {
  // const { baseType, refType, isNullable, hasStringProps, hasAggregates } = params

  // TODO: validate that all props of the input type actually match the expected type

  return true
}

function buildOptimizedType(
  inputType: InputType,
  { baseType, refType, isNullable, hasStringProps, hasAggregates }: InputTypeParams,
) {
  let optimizedType = ts
    .interfaceDeclaration(inputType.name)
    .addGenericParameter(ts.genericParameter('$PrismaModel').default(ts.neverType))

  optimizedType = optimizedType
    .addGenericParameter(ts.genericParameter('Null').default(isNullable ? ts.nullType : ts.neverType))
    .extends(
      ts
        .namedType('BaseFilter')
        .addGenericArgument(baseType)
        .addGenericArgument(ts.namedType(refType).addGenericArgument(ts.namedType('$PrismaModel')))
        .addGenericArgument(ts.namedType('Null')),
    )

  if (hasStringProps) {
    optimizedType = optimizedType.extends(
      ts
        .namedType('StringProps')
        .addGenericArgument(baseType)
        .addGenericArgument(ts.namedType(refType).addGenericArgument(ts.namedType('$PrismaModel'))),
    )
  }

  if (hasAggregates) {
    optimizedType = optimizedType.extends(
      ts
        .namedType('BaseAggregateProps')
        .addGenericArgument(ts.namedType('$PrismaModel'))
        .addGenericArgument(ts.namedType('Null')),
    )
  }

  return ts.moduleExport(optimizedType)
}
