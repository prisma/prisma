import indent from 'indent-string'
import { DMMF } from '../../runtime/dmmf-types'
import {
  argIsInputType,
  GraphQLScalarToJSTypeTable,
  JSOutputTypeToInputType,
} from '../../runtime/utils/common'
import { uniqueBy } from '../../runtime/utils/uniqueBy'
import { TAB_SIZE } from './constants'
import { Generatable } from './Generatable'
import { ExportCollector, wrapComment } from './helpers'

export class InputField implements Generatable {
  constructor(
    protected readonly field: DMMF.SchemaArg,
    protected readonly prefixFilter = false,
    protected readonly noEnumerable = false,
  ) {}
  public toTS(): string {
    const { field } = this

    const optionalStr = field.isRequired ? '' : '?'
    const jsdoc = field.comment ? wrapComment(field.comment) + '\n' : ''
    const fieldType = stringifyInputTypes(
      field.inputTypes,
      this.prefixFilter,
      this.noEnumerable,
    )

    return `${jsdoc}${field.name}${optionalStr}: ${fieldType}`
  }
}

function stringifyInputType(
  t: DMMF.SchemaArgInputType,
  prefixFilter: boolean,
  noEnumerable = false, // used for group by, there we need an Array<> for "by"
): string {
  let type =
    typeof t.type === 'string'
      ? GraphQLScalarToJSTypeTable[t.type] || t.type
      : prefixFilter
      ? `Base${t.type.name}`
      : t.type.name
  type = JSOutputTypeToInputType[type] ?? type

  if (type === 'Null') {
    return 'null'
  }

  if (t.isList) {
    const keyword = noEnumerable ? 'Array' : 'Enumerable'
    if (Array.isArray(type)) {
      return type.map((t) => `${keyword}<${t}>`).join(' | ')
    } else {
      return `${keyword}<${type}>`
    }
  }

  if (Array.isArray(type)) {
    type = type.join(' | ')
  }

  return type
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
function stringifyInputTypes(
  inputTypes: DMMF.SchemaArgInputType[],
  prefixFilter: boolean,
  noEnumerable = false,
): string {
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

  const filteredInputTypes = inputTypes.filter(
    (t, i) => !singularPairIndexes.has(i),
  )

  const inputObjectTypes = filteredInputTypes.filter(
    (t) => t.location === 'inputObjectTypes',
  )

  const nonInputObjectTypes = filteredInputTypes.filter(
    (t) => t.location !== 'inputObjectTypes',
  )

  const stringifiedInputObjectTypes = inputObjectTypes.reduce<string>(
    (acc, curr) => {
      const currentStringified = stringifyInputType(
        curr,
        prefixFilter,
        noEnumerable,
      )
      if (acc.length > 0) {
        return `XOR<${currentStringified}, ${acc}>`
      }

      return currentStringified
    },
    '',
  )

  const stringifiedNonInputTypes = nonInputObjectTypes
    .map((type) => stringifyInputType(type, prefixFilter, noEnumerable))
    .join(' | ')

  if (stringifiedNonInputTypes.length === 0) {
    return stringifiedInputObjectTypes
  }

  if (stringifiedInputObjectTypes.length === 0) {
    return stringifiedNonInputTypes
  }

  return `${stringifiedInputObjectTypes} | ${stringifiedNonInputTypes}`
}

export class InputType implements Generatable {
  constructor(
    protected readonly type: DMMF.InputType,
    protected readonly collector?: ExportCollector,
  ) {}
  public toTS(): string {
    const { type } = this
    this.collector?.addSymbol(type.name)

    const fields = uniqueBy(type.fields, (f) => f.name)
    // TO DISCUSS: Should we rely on TypeScript's error messages?
    const body = `{
${indent(
  fields
    .map((arg) =>
      new InputField(arg /*, type.atLeastOne && !type.atMostOne*/).toTS(),
    )
    .join('\n'),
  TAB_SIZE,
)}
}`
    return `
export type ${type.name} = ${body}`
  }
}
