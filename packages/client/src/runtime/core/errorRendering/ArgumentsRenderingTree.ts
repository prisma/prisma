import { lowerCase } from '../../../generation/utils/common'
import { isValidDate } from '../../utils/date'
import { isDecimalJsLike } from '../../utils/decimalJsLike'
import { isFieldRef } from '../model/FieldRef'
import { ObjectEnumValue } from '../types/exported/ObjectEnums'
import { ArrayValue } from './ArrayValue'
import { Colors, ErrorBasicBuilder, ErrorWriter } from './base'
import { ObjectField } from './ObjectField'
import { ObjectValue } from './ObjectValue'
import { ScalarValue } from './ScalarValue'

type MessageRender = (colors: Colors) => string

export class ArgumentsRenderingTree implements ErrorBasicBuilder {
  readonly arguments: ObjectValue
  private errorMessages: MessageRender[] = []

  constructor(args: ObjectValue) {
    this.arguments = args
  }

  write(writer: ErrorWriter): void {
    writer.write(this.arguments)
  }

  addErrorMessage(renderer: MessageRender) {
    this.errorMessages.push(renderer)
  }

  renderAllMessages(colors: Colors): string {
    return this.errorMessages.map((messageRenderer) => messageRenderer(colors)).join('\n')
  }
}

/**
 * Given JS call arguments, produces rendering tree for outputting rich errors into the console
 * Difference between rendering tree and plain object is that fields and values can have different attributes:
 * colors, underlines, markers on the margins. `applyValidationError` function will then apply specific formatting
 * to the rendering tree.
 *
 * @param args
 * @returns
 */
export function buildArgumentsRenderingTree(args: Record<PropertyKey, unknown>): ArgumentsRenderingTree {
  return new ArgumentsRenderingTree(buildInputObject(args))
}

function buildInputObject(inputObject: Record<PropertyKey, unknown>) {
  const object = new ObjectValue()

  for (const [key, value] of Object.entries(inputObject)) {
    const field = new ObjectField(key, buildInputValue(value))
    object.addField(field)
  }
  return object
}

function buildInputArray(array: unknown[]) {
  const result = new ArrayValue()
  for (const item of array) {
    result.addItem(buildInputValue(item))
  }
  return result
}

function buildInputValue(value: unknown) {
  if (value === undefined) {
    return new ScalarValue('undefined')
  } else if (value === null) {
    return new ScalarValue('null')
  } else if (typeof value === 'string') {
    return handleString(JSON.stringify(value))
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    return handleNumberOrBoolean(value)
  } else if (typeof value === 'bigint') {
    return handleBigInt(value)
  } else {
    return handleObject(value as {})
  }
}

function handleString(value: string) {
  return new ScalarValue(JSON.stringify(value))
}

function handleNumberOrBoolean(value: number | boolean) {
  return new ScalarValue(String(value))
}

function handleBigInt(value: bigint) {
  return new ScalarValue(`${value}n`)
}

function handleObject(value: object) {
  if (isDecimalJsLike(value)) {
    return new ScalarValue(`new Prisma.Decimal("${value.toFixed()}")`)
  }

  if (value instanceof Uint8Array) {
    return handleUint8Array(value)
  }

  if (value instanceof Date) {
    return handleDate(value)
  }

  if (value instanceof ObjectEnumValue) {
    return handleObjectEnumValue(value)
  }

  if (isFieldRef(value)) {
    return handleFieldRef(value)
  }

  if (Array.isArray(value)) {
    return buildInputArray(value)
  }

  if (typeof value === 'object') {
    return buildInputObject(value as Record<PropertyKey, unknown>)
  }

  return new ScalarValue(Object.prototype.toString.call(value))
}

function handleUint8Array(value: Uint8Array) {
  if (Buffer.isBuffer(value)) {
    return new ScalarValue(`Buffer.alloc(${value.byteLength})`)
  }
  return new ScalarValue(`new Uint8Array(${value.byteLength})`)
}

function handleDate(value: Date) {
  const dateStr = isValidDate(value) ? value.toISOString() : 'Invalid Date'
  return new ScalarValue(`new Date("${dateStr}")`)
}

function handleObjectEnumValue(value: ObjectEnumValue) {
  return new ScalarValue(`Prisma.${value._getName()}`)
}

function handleFieldRef(value) {
  return new ScalarValue(`prisma.${lowerCase(value.modelName)}.$fields.${value.name}`)
}
