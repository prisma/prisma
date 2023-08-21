import { INDENT_SIZE } from '../../../generation/ts-builders/Writer'
import { ArrayValue } from './ArrayValue'
import { ErrorWriter, fieldsSeparator } from './base'
import { Field } from './Field'
import { FormattedString } from './FormattedString'
import { ObjectField } from './ObjectField'
import { ObjectFieldSuggestion } from './ObjectFieldSuggestion'
import { Value } from './Value'

type SelectionParent = {
  kind: 'include' | 'select'
  value: ObjectValue
}

/**
 * Class for representing object value within rendering tree. Also used for accessing
 * different fields of the object.
 *
 * Terminology used within:
 * - selection parent = either `select` or `include` property value. For example for object
 * `{ select: { posts: true }}`, selection parent is `{ posts: true }`
 * - sub selection: value of a property of selection parent. Can be deep. In that case, specified
 * path is expected to not contain either `select` or `include` values in between (the way engine reports `selectionPath`).
 * For example, for this query:
 *
 * {
 *   include: {
 *     posts: {
 *       select: { attachments: { where: { published: true }} }
 *     }
 *   }
 * }
 * Value of sub selection at path [posts, attachments] is { where: { published: true }}
 */
export class ObjectValue extends Value {
  private fields: Record<string, ObjectField> = {}
  private suggestions: ObjectFieldSuggestion[] = []

  addField(field: ObjectField) {
    this.fields[field.name] = field
  }

  addSuggestion(suggestion: ObjectFieldSuggestion) {
    this.suggestions.push(suggestion)
  }

  getField(key: string): ObjectField | undefined {
    return this.fields[key]
  }

  getDeepField(path: string[]): Field | undefined {
    const [head, ...tail] = path
    const firstField = this.getField(head)
    if (!firstField) {
      return undefined
    }
    let field: Field = firstField
    for (const segment of tail) {
      let nextField: Field | undefined

      if (field.value instanceof ObjectValue) {
        nextField = field.value.getField(segment)
      } else if (field.value instanceof ArrayValue) {
        nextField = field.value.getField(Number(segment))
      }
      if (!nextField) {
        return undefined
      }
      field = nextField
    }
    return field
  }

  getDeepFieldValue(path: string[]) {
    if (path.length === 0) {
      return this
    }
    return this.getDeepField(path)?.value
  }

  hasField(key: string) {
    return Boolean(this.getField(key))
  }

  removeAllFields() {
    this.fields = {}
  }

  removeField(key: string) {
    delete this.fields[key]
  }

  getFields() {
    return this.fields
  }

  isEmpty(): boolean {
    return Object.keys(this.fields).length === 0
  }

  getFieldValue(key: string): Value | undefined {
    return this.getField(key)?.value
  }

  getDeepSubSelectionValue(path: string[]): Value | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let selection: Value = this
    for (const segment of path) {
      if (!(selection instanceof ObjectValue)) {
        return undefined
      }
      const next = selection.getSubSelectionValue(segment)
      if (!next) {
        return undefined
      }

      selection = next
    }

    return selection
  }

  getDeepSelectionParent(path: string[]): SelectionParent | undefined {
    const thisParent = this.getSelectionParent()
    if (!thisParent) {
      return undefined
    }

    let parent = thisParent

    for (const segment of path) {
      const next = parent.value.getFieldValue(segment)
      if (!next || !(next instanceof ObjectValue)) {
        return undefined
      }

      const nextParent = next.getSelectionParent()
      if (!nextParent) {
        return undefined
      }
      parent = nextParent
    }

    return parent
  }

  getSelectionParent(): SelectionParent | undefined {
    const select = this.getField('select')
    if (select?.value instanceof ObjectValue) {
      return { kind: 'select', value: select.value }
    }

    const include = this.getField('include')
    if (include?.value instanceof ObjectValue) {
      return { kind: 'include', value: include.value }
    }
    return undefined
  }

  getSubSelectionValue(key: string): Value | undefined {
    return this.getSelectionParent()?.value.fields[key].value
  }

  override getPrintWidth(): number {
    const fields = Object.values(this.fields)
    if (fields.length == 0) {
      return 2 // {}
    }
    const maxFieldWidth = Math.max(...fields.map((f) => f.getPrintWidth()))
    return maxFieldWidth + INDENT_SIZE
  }

  override write(writer: ErrorWriter): void {
    const fields = Object.values(this.fields)
    if (fields.length === 0 && this.suggestions.length === 0) {
      this.writeEmpty(writer)
      return
    }

    this.writeWithContents(writer, fields)
  }

  private writeEmpty(writer: ErrorWriter) {
    const output = new FormattedString('{}')
    if (this.hasError) {
      output.setColor(writer.context.colors.red).underline()
    }

    writer.write(output)
  }

  private writeWithContents(writer: ErrorWriter, fields: ObjectField[]) {
    writer.writeLine('{').withIndent(() => {
      writer.writeJoined(fieldsSeparator, [...fields, ...this.suggestions]).newLine()
    })

    writer.write('}')
    if (this.hasError) {
      writer.afterNextNewline(() => {
        writer.writeLine(writer.context.colors.red('~'.repeat(this.getPrintWidth())))
      })
    }
  }
}
