import indent from 'indent-string'

import { uniqueBy } from '../../runtime/utils/uniqueBy'
import type { DMMF } from '../dmmf-types'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import * as ts from '../ts-builders'
import { GraphQLScalarToJSTypeTable, JSOutputTypeToInputType } from '../utils/common'
import { TAB_SIZE } from './constants'
import type { Generatable } from './Generatable'

export class InputField implements Generatable {
  constructor(
    protected readonly field: DMMF.SchemaArg,
    protected readonly genericsInfo: GenericArgsInfo,
    protected readonly source?: string,
  ) {}
  public toTS(): string {
    const property = buildInputField(this.field, this.genericsInfo, this.source)
    return ts.stringify(property)
  }
}

function buildInputField(field: DMMF.SchemaArg, genericsInfo: GenericArgsInfo, source?: string) {
  const tsType = buildAllFieldTypes(field.inputTypes, genericsInfo, source)

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
        return union.mapVariants((variant) => ts.array(variant))
      }
      return union
    }

    type = namedInputType(scalarType ?? t.type)
  } else {
    type = namedInputType(t.type.name)
  }

  if (type.name.endsWith('Select') || type.name.endsWith('Include')) {
    type.addGenericArgument(ts.namedType('ExtArgs'))
  }

  if (genericsInfo.needsGenericModelArg(t)) {
    if (source) {
      type.addGenericArgument(ts.stringLiteral(source))
    } else {
      type.addGenericArgument(ts.namedType('$PrismaModel'))
    }
  }

  if (t.isList) {
    return ts.array(type)
  }

  return type
}

function namedInputType(typeName: string) {
  return ts.namedType(JSOutputTypeToInputType[typeName] ?? typeName)
}

/**
 * Examples:
 * T[], T => T | T[]
 * T, U => XOR<T,U>
 * T[], T, U => XOR<T, U> | T[]
 * T[], U => T[] | U
 * T, U, null => XOR<T,U> | null
 * T, U, V, W, null => XOR<T, XOR<U, XOR<V, W>>> | null
 *
 * 1. Separate XOR and non XOR items (objects and non-objects)
 * 2. Generate them out and `|` them
 */
function buildAllFieldTypes(
  inputTypes: DMMF.SchemaArgInputType[],
  genericsInfo: GenericArgsInfo,
  source?: string,
): ts.TypeBuilder {
  const inputObjectTypes = inputTypes.filter((t) => t.location === 'inputObjectTypes' && !t.isList)

  const otherTypes = inputTypes.filter((t) => t.location !== 'inputObjectTypes' || t.isList)

  const tsInputObjectTypes = inputObjectTypes.map((type) => buildSingleFieldType(type, genericsInfo, source))

  const tsOtherTypes = otherTypes.map((type) => buildSingleFieldType(type, genericsInfo, source))

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
      return new InputField(arg, this.genericsInfo, source).toTS()
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
