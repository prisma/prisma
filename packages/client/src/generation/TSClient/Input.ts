import indent from 'indent-string'
import { P } from 'ts-pattern'

import type { DMMF } from '../../runtime/dmmf-types'
import { argIsInputType, GraphQLScalarToJSTypeTable, JSOutputTypeToInputType } from '../../runtime/utils/common'
import { uniqueBy } from '../../runtime/utils/uniqueBy'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import * as ts from '../ts-builders'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'
import { ifExtensions } from './utils/ifExtensions'

export class InputField implements Generatable {
  constructor(
    protected readonly field: DMMF.SchemaArg,
    protected readonly prefixFilter = false,
    protected readonly noEnumerable = false,
    protected readonly genericsInfo: GenericArgsInfo,
    protected readonly source?: string,
  ) {}
  public toTS(): string {
    const property = buildInputField(this.field, this.prefixFilter, this.noEnumerable, this.genericsInfo, this.source)
    return ts.stringify(property)
  }
}

function buildInputField(
  field: DMMF.SchemaArg,
  prefixFilter = false,
  noEnumerable = false,
  genericsInfo: GenericArgsInfo,
  source?: string,
) {
  const tsType = buildAllFieldTypes(field.inputTypes, prefixFilter, noEnumerable, genericsInfo, source)

  const tsProperty = ts.property(field.name, tsType)
  if (!field.isRequired) {
    tsProperty.optional()
  }
  const docComment = ts.docComment()
  if (field.comment) {
    docComment.addText(field.comment)
  }
  if (field.deprecation) {
    docComment.addText(`@deprecated since ${field.deprecation.sinceVersion}: ${field.deprecation.reason}`)
  }

  if (docComment.lines.length > 0) {
    tsProperty.setDocComment(docComment)
  }

  return tsProperty
}

function buildSingleFieldType(
  t: DMMF.SchemaArgInputType,
  prefixFilter: boolean,
  noEnumerable = false, // used for group by, there we need an Array<> for "by"
  genericsInfo: GenericArgsInfo,
  source?: string,
): ts.TypeBuilder {
  let type: ts.NamedType
  if (typeof t.type === 'string') {
    if (t.type === 'Null') {
      return ts.nullType
    }
    const scalarType = GraphQLScalarToJSTypeTable[t.type]
    if (Array.isArray(scalarType)) {
      const union = ts.unionType(scalarType.map(namedInputType))
      if (t.isList) {
        return union.mapVariants((variant) => wrapList(variant, noEnumerable))
      }
      return union
    }

    if (!scalarType) {
      type = namedInputType(t.type)
    } else if (Array.isArray(scalarType)) {
      type = ts.unionType(scalarType.map(namedInputType))
    } else {
      type = namedInputType(scalarType)
    }
  } else if (prefixFilter) {
    type = namedInputType(`Base${t.type.name}`)
  } else {
    type = namedInputType(t.type.name)
  }

  ifExtensions(() => {
    if (type.name.endsWith('Select') || type.name.endsWith('Include')) {
      type.addGenericArgument(ts.namedType('ExtArgs'))
    }
  }, undefined)

  if (genericsInfo.needsGenericModelArg(t)) {
    if (source) {
      type.addGenericArgument(ts.stringLiteral(source))
    } else {
      type.addGenericArgument(ts.namedType('$PrismaModel'))
    }
  }

  if (t.isList) {
    return wrapList(type, noEnumerable)
  }

  return type
}

function namedInputType(typeName: string) {
  return ts.namedType(JSOutputTypeToInputType[typeName] ?? typeName)
}

function wrapList(type: ts.TypeBuilder, noEnumerable: boolean): ts.TypeBuilder {
  return noEnumerable ? ts.array(type) : ts.namedType('Enumerable').addGenericArgument(type)
}

/**
 * Examples:
 * T[], T => Enum<T>
 * T, U => XOR<T,U>
 * T[], U => Enum<T> | U
 * T, U, null => XOR<T,U> | null
 * T, U, V, W, null => XOR<T, XOR<U, XOR<V, W>>> | null
 *
 * 1. Filter out singular T, if list T[] exists
 * 2. Separate XOR and non XOR items (objects and non-objects)
 * 3. Generate them out and `|` them
 */
function buildAllFieldTypes(
  inputTypes: DMMF.SchemaArgInputType[],
  prefixFilter: boolean,
  noEnumerable = false,
  genericsInfo: GenericArgsInfo,
  source?: string,
): ts.TypeBuilder {
  const pairMap: Record<string, number> = Object.create(null)

  const singularPairIndexes = new Set<number>()

  for (let i = 0; i < inputTypes.length; i++) {
    const inputType = inputTypes[i]
    if (argIsInputType(inputType.type)) {
      const { name } = inputType.type
      if (typeof pairMap[name] === 'number') {
        if (inputType.isList) {
          singularPairIndexes.add(pairMap[name])
        } else {
          singularPairIndexes.add(i)
        }
      } else {
        pairMap[name] = i
      }
    }
  }

  const filteredInputTypes = inputTypes.filter((t, i) => !singularPairIndexes.has(i))

  const inputObjectTypes = filteredInputTypes.filter((t) => t.location === 'inputObjectTypes')

  const otherTypes = filteredInputTypes.filter((t) => t.location !== 'inputObjectTypes')

  const tsInputObjectTypes = inputObjectTypes.map((type) =>
    buildSingleFieldType(type, prefixFilter, noEnumerable, genericsInfo, source),
  )

  const tsOtherTypes = otherTypes.map((type) =>
    buildSingleFieldType(type, prefixFilter, noEnumerable, genericsInfo, source),
  )

  if (tsOtherTypes.length === 0) {
    return xorTypes(tsInputObjectTypes)
  }

  if (tsInputObjectTypes.length === 0) {
    return ts.unionType(tsOtherTypes)
  }

  return ts.unionType(xorTypes(tsInputObjectTypes)).addVariants(tsOtherTypes)
}

function xorTypes(types: ts.TypeBuilder[]) {
  return types.reduce((prev, curr) => ts.namedType('XOR').addGenericArgument(prev).addGenericArgument(curr))
}

export class InputType implements Generatable {
  constructor(protected readonly type: DMMF.InputType, protected readonly genericsInfo: GenericArgsInfo) {}

  public toTS(): string {
    const { type } = this
    const source = type.meta?.source

    const fields = uniqueBy(type.fields, (f) => f.name)
    // TO DISCUSS: Should we rely on TypeScript's error messages?
    const body = `{
${indent(
  fields
    .map((arg) => {
      // This disables enumerable on JsonFilter path argument
      const noEnumerable = type.name.includes('Json') && type.name.includes('Filter') && arg.name === 'path'
      return new InputField(arg, false, noEnumerable, this.genericsInfo, source).toTS()
    })
    .join('\n'),
  TAB_SIZE,
)}
}`
    return `
export type ${this.getTypeName()} = ${wrapWithAtLeast(body, type)}`
  }

  private getTypeName() {
    if (this.genericsInfo.inputTypeNeedsGenericModelArg(this.type)) {
      return `${this.type.name}<$PrismaModel = never>`
    }
    return this.type.name
  }
}

/**
 * Wraps an input type with `Prisma.AtLeast`
 * @param body type string to wrap
 * @param input original input type
 * @returns
 */
function wrapWithAtLeast(body: string, input: DMMF.InputType) {
  if (input.constraints?.fields && input.constraints.fields.length > 0) {
    const fields = input.constraints.fields.map((f) => `"${f}"`).join(' | ')
    return `Prisma.AtLeast<${body}, ${fields}>`
  }

  return body
}
