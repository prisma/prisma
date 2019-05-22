import { Arg, Document, Field, Args } from './query'
import { stringifyInputType } from './utils/common'
import chalk from 'chalk'

interface Visitor {
  Arg: {
    enter: (node: Arg) => Arg | undefined
  }
}

export function visit(document: Document, visitor: Visitor): Document {
  const children = document.children.map(field => visitField(field, visitor))
  if (
    document.children.length === children.length &&
    document.children.every((child, index) => child === children[index])
  ) {
    return document
  }
  const newDoc = new Document(document.type, children)
  return newDoc
}

function visitField(field: Field, visitor: Visitor): Field {
  const args = field.args ? field.args.args.map(arg => visitArg(arg, visitor)) : undefined
  const newArgs = args ? new Args(args) : undefined
  const children = field.children ? field.children.map(child => visitField(child, visitor)) : undefined

  const argsDidntChange =
    (!newArgs && !field.args) ||
    (field.args &&
      newArgs &&
      (field.args.args.length === newArgs.args.length &&
        field.args.args.every((arg, index) => arg === newArgs.args[index])))

  const fieldsDidntChange =
    (!field.children && !children) ||
    (field.children &&
      children &&
      field.children.length === children.length &&
      field.children.every((child, index) => child === children[index]))

  if (argsDidntChange && fieldsDidntChange) {
    return field
  }

  return new Field({
    name: field.name,
    args: newArgs,
    children,
    error: field.error,
  })
}

function isArgsArray(input: any): input is Array<Args> {
  if (Array.isArray(input)) {
    return input.every(arg => arg instanceof Args)
  }

  return false
}

function visitArg(arg: Arg, visitor: Visitor): Arg {
  function mapArgs(inputArgs: Args) {
    const { args } = inputArgs
    const newArgs = args.map(arg => visitArg(arg, visitor))
    if (newArgs.length !== args.length || args.find((a, i) => a !== newArgs[i])) {
      return new Args(newArgs)
    }
    return inputArgs
  }

  const newArg = visitor.Arg.enter(arg) || arg

  let newValue = newArg.value
  if (isArgsArray(newArg.value)) {
    newValue = newArg.value.map(mapArgs)
  } else if (newArg.value instanceof Args) {
    newValue = mapArgs(newArg.value)
  }

  if (newValue !== newArg.value) {
    return new Arg({
      key: newArg.key,
      value: newValue,
      error: newArg.error,
      argType: newArg.argType,
      isEnum: newArg.isEnum,
    })
  }

  return newArg
}
