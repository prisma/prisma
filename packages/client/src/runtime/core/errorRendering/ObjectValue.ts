import { ErrorBasicBuilder, ErrorWriter, fieldsSeparator } from './base'
import { ObjectField } from './ObjectField'
import { ObjectFieldSuggestion } from './ObjectFieldSuggestion'
import { Value } from './Value'

type SelectionParent = {
  kind: 'include' | 'select'
  value: ObjectValue
}

export class ObjectValue implements ErrorBasicBuilder {
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

  getDeepField(path: string[]): ObjectField | undefined {
    const [head, ...tail] = path
    const firstField = this.getField(head)
    if (!firstField) {
      return undefined
    }
    let field = firstField
    for (const segment of tail) {
      if (!(field.value instanceof ObjectValue)) {
        return undefined
      }
      const nextField = field.value.getField(segment)
      if (!nextField) {
        return undefined
      }
      field = nextField
    }
    return field
  }

  getDeepFieldValue(path: string[]): Value | undefined {
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

  isEmpty(): boolean {
    return Object.keys(this.fields).length === 0
  }

  getFieldValue(key: string): Value | undefined {
    return this.getField(key)?.value
  }

  getDeepSelectionValue(path: string[]): Value | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let selection: Value = this
    for (const segment of path) {
      if (!(selection instanceof ObjectValue)) {
        return undefined
      }
      const next = selection.getSelectionValue(segment)
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

  getSelectionValue(key: string): Value | undefined {
    return this.getSelectionParent()?.value.fields[key].value
  }

  write(writer: ErrorWriter): void {
    const fields = Object.values(this.fields)
    if (fields.length === 0 && this.suggestions.length === 0) {
      writer.write('{}')
      return
    }

    writer.writeLine('{').withIndent(() => {
      writer.writeJoined(fieldsSeparator, [...fields, ...this.suggestions]).newLine()
    })

    writer.write('}')
  }
}
