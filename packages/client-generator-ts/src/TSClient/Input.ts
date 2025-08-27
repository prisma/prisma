import { uniqueBy } from '@prisma/client-common'
import type * as DMMF from '@prisma/dmmf'
import * as ts from '@prisma/ts-builders'
import indent from 'indent-string'

import { GenericArgsInfo } from '../GenericsArgsInfo'
import { appendSkipType } from '../utils'
import { GraphQLScalarToJSTypeTable, JSOutputTypeToInputType } from '../utils/common'
import { TAB_SIZE } from './constants'
import { GenerateContext } from './GenerateContext'

export class InputField {
  constructor(
    protected readonly field: DMMF.SchemaArg,
    protected readonly context: GenerateContext,
    protected readonly source?: string,
  ) {}
  public toTS(): string {
    const property = buildInputField(this.field, this.context, this.source)
    return ts.stringify(property)
  }
}

export function buildInputField(field: DMMF.SchemaArg, context: GenerateContext, source?: string): ts.Property {
  const tsType = buildAllFieldTypes(field.inputTypes, context, source)

  const tsProperty = ts.property(field.name, field.isRequired ? tsType : appendSkipType(context, tsType))
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

function buildSingleFieldType(t: DMMF.InputTypeRef, genericsInfo: GenericArgsInfo, source?: string): ts.TypeBuilder {
  let type: ts.NamedType

  const scalarType = GraphQLScalarToJSTypeTable[t.type]
  if (t.location === 'enumTypes' && t.namespace === 'model') {
    type = ts.namedType(`$Enums.${t.type}`)
  } else if (t.type === 'Null') {
    return ts.nullType
  } else if (Array.isArray(scalarType)) {
    const union = ts.unionType(scalarType.map(namedInputType))
    if (t.isList) {
      return union.mapVariants((variant) => ts.array(variant))
    }
    return union
  } else if (t.namespace === 'prisma') {
    type = namedInputType(`Prisma.${t.type}`)
  } else {
    type = namedInputType(scalarType ?? t.type)
  }

  if (genericsInfo.typeRefNeedsGenericModelArg(t)) {
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
  const typeNameParts = typeName.split('.')
  const typeNameWithoutNamespace = typeNameParts[typeNameParts.length - 1]
  const mappedInputTypeName = JSOutputTypeToInputType[typeNameWithoutNamespace] ?? typeNameWithoutNamespace
  return ts.namedType(typeNameParts.slice(0, -1).concat(mappedInputTypeName).join('.'))
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
  inputTypes: readonly DMMF.InputTypeRef[],
  context: GenerateContext,
  source?: string,
): ts.TypeBuilder {
  const inputObjectTypes = inputTypes.filter((t) => t.location === 'inputObjectTypes' && !t.isList)

  const otherTypes = inputTypes.filter((t) => t.location !== 'inputObjectTypes' || t.isList)

  const tsInputObjectTypes = inputObjectTypes.map((type) => buildSingleFieldType(type, context.genericArgsInfo, source))

  const tsOtherTypes = otherTypes.map((type) => buildSingleFieldType(type, context.genericArgsInfo, source))

  if (tsOtherTypes.length === 0) {
    return xorTypes(tsInputObjectTypes)
  }

  if (tsInputObjectTypes.length === 0) {
    return ts.unionType(tsOtherTypes)
  }

  return ts.unionType(xorTypes(tsInputObjectTypes)).addVariants(tsOtherTypes)
}

function xorTypes(types: ts.TypeBuilder[]) {
  return types.reduce((prev, curr) => ts.namedType('Prisma.XOR').addGenericArgument(prev).addGenericArgument(curr))
}

export class InputType {
  private generatedName: string
  constructor(
    protected readonly type: DMMF.InputType,
    protected readonly context: GenerateContext,
  ) {
    this.generatedName = type.name
  }

  public toTS(): string {
    const { type } = this
    const source = type.meta?.source

    const fields = uniqueBy(type.fields, (f) => f.name)
    // TO DISCUSS: Should we rely on TypeScript's error messages?
    const body = `{
${indent(
  fields
    .map((arg) => {
      return new InputField(arg, this.context, source).toTS()
    })
    .join('\n'),
  TAB_SIZE,
)}
}`

    const needsGeneric = this.context.genericArgsInfo.typeNeedsGenericModelArg(this.type)
    const typeName = needsGeneric ? `${this.type.name}<$PrismaModel = never>` : this.type.name

    if (type.name.includes('Json') && type.name.includes('Filter')) {
      const innerName = needsGeneric ? `${this.type.name}Base<$PrismaModel>` : `${this.type.name}Base`
      // This generates types for JsonFilter to prevent the usage of 'path' without another parameter
      const baseName = `Required<${innerName}>`
      return `
export type ${typeName} =
| Prisma.PatchUndefined<
    Prisma.Either<${baseName}, Exclude<keyof ${baseName}, 'path'>>,
    ${baseName}
  >
| Prisma.OptionalFlat<Omit<${baseName}, 'path'>>

export type ${this.type.name}Base${needsGeneric ? '<$PrismaModel = never>' : ''} = ${wrapWithAtLeast(body, type)}`
    } else {
      return `
export type ${typeName} = ${wrapWithAtLeast(body, type)}`
    }
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
