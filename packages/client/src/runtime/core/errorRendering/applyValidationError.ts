import {
  ArgumentDescription,
  EmptySelectionError,
  InputTypeDescription,
  InvalidArgumentTypeError,
  InvalidArgumentValueError,
  OutputTypeDescription,
  RequiredArgumentMissingError,
  UnionError,
  UnknownArgumentError,
  UnknownInputFieldError,
  UnknownSelectionFieldError,
} from '@prisma/engine-core'
import { maxBy } from '@prisma/internals'
import chalk from 'chalk'
import levenshtein from 'js-levenshtein'

import { IncludeAndSelectError, IncludeOnScalarError, ValidationError } from '../types/ValidationError'
import { ArgumentsRenderingTree } from './ArgumentsRenderingTree'
import { ObjectFieldSuggestion } from './ObjectFieldSuggestion'
import { ObjectValue } from './ObjectValue'
import { SuggestionObjectValue } from './SuggestionObjectValue'

export function applyValidationError(error: ValidationError, args: ArgumentsRenderingTree): void {
  switch (error.kind) {
    case 'IncludeAndSelect':
      applyIncludeAndSelectError(error, args)
      break
    case 'IncludeOnScalar':
      applyIncludeOnScalarError(error, args)
      break
    case 'EmptySelection':
      applyEmptySelectionError(error, args)
      break
    case 'UnknownSelectionField':
      applyUnknownSelectionFieldError(error, args)
      break
    case 'UnknownArgument':
      applyUnknownArgumentError(error, args)
      break
    case 'UnknownInputField':
      applyUnknownInputFieldError(error, args)
      break
    case 'RequiredArgumentMissing':
      applyRequiredArgumentMissingError(error, args)
      break
    case 'InvalidArgumentType':
      applyInvalidArgumentTypeError(error, args)
      break
    case 'InvalidArgumentValue':
      applyInvalidArgumentValueError(error, args)
      break
    case 'Union':
      applyUnionError(error, args)
      break
    default:
      console.log(error)
      throw new Error('not implemented: ' + error.kind)
  }
}

function applyIncludeAndSelectError(error: IncludeAndSelectError, argsTree: ArgumentsRenderingTree) {
  const object = argsTree.arguments.getDeepSubSelectionValue(error.selectionPath)
  if (object && object instanceof ObjectValue) {
    object.getField('include')?.markAsError()
    object.getField('select')?.markAsError()
  }

  argsTree.addErrorMessage(
    (chalk) =>
      `Please ${chalk.bold('either')} use ${chalk.greenBright('`include`')} or ${chalk.greenBright(
        '`select`',
      )}, but ${chalk.redBright('not both')} at the same time.`,
  )
}

function applyIncludeOnScalarError(error: IncludeOnScalarError, argsTree: ArgumentsRenderingTree) {
  const [selectionPath, field] = splitPath(error.selectionPath)
  const outputType = error.outputType

  const object = argsTree.arguments.getDeepSelectionParent(selectionPath)?.value
  if (object) {
    object.getField(field)?.markAsError()

    if (outputType) {
      for (const field of outputType.fields) {
        if (field.isRelation) {
          object.addSuggestion(new ObjectFieldSuggestion(field.name, 'true'))
        }
      }
    }
  }

  argsTree.addErrorMessage((chalk) => {
    let msg = `Invalid scalar field ${chalk.redBright(`\`${field}\``)} for ${chalk.bold('include')} statement`
    if (outputType) {
      msg += ` on model ${chalk.bold(outputType.name)}. ${availableOptionsMessage(chalk)}`
    } else {
      msg += '.'
    }

    msg += `\nNote, that ${chalk.bold('include')} statements only accept relation fields.`
    return msg
  })
}

function applyEmptySelectionError(error: EmptySelectionError, argsTree: ArgumentsRenderingTree) {
  const outputType = error.outputType
  const selection = argsTree.arguments.getDeepSelectionParent(error.selectionPath)?.value
  const isEmpty = selection?.isEmpty() ?? false

  if (selection) {
    selection.removeAllFields()
    addSelectionSuggestions(selection, outputType)
  }

  argsTree.addErrorMessage((chalk) => {
    if (isEmpty) {
      return `The ${chalk.red('`select`')} statement for type ${chalk.bold(
        outputType.name,
      )} must not be empty. ${availableOptionsMessage(chalk)}`
    }
    return `The ${chalk.red('`select`')} statement for type ${chalk.bold(outputType.name)} needs ${chalk.bold(
      'at least one truthy value',
    )}.`
  })
}

function applyUnknownSelectionFieldError(error: UnknownSelectionFieldError, argsTree: ArgumentsRenderingTree) {
  const [parentPath, fieldName] = splitPath(error.selectionPath)

  const selectionParent = argsTree.arguments.getDeepSelectionParent(parentPath)
  if (selectionParent) {
    selectionParent.value.getField(fieldName)?.markAsError()
    addSelectionSuggestions(selectionParent.value, error.outputType)
  }

  argsTree.addErrorMessage((chalk) => {
    const parts = [`Unknown field ${chalk.redBright(`\`${fieldName}\``)}`]
    if (selectionParent) {
      parts.push(`for ${chalk.bold(selectionParent.kind)} statement`)
    }
    parts.push(`on model ${chalk.bold(error.outputType.name)}.`)
    parts.push(availableOptionsMessage(chalk))
    return parts.join(' ')
  })
}

function applyUnknownArgumentError(error: UnknownArgumentError, argsTree: ArgumentsRenderingTree) {
  const argName = error.argumentPath[0]
  const selection = argsTree.arguments.getDeepSubSelectionValue(error.selectionPath)

  if (selection instanceof ObjectValue) {
    selection.getField(argName)?.markAsError()
    addArgumentsSuggestions(selection, error.arguments)
  }

  argsTree.addErrorMessage((chalk) =>
    unknownArgumentMessage(
      chalk,
      argName,
      error.arguments.map((arg) => arg.name),
    ),
  )
}

function applyUnknownInputFieldError(error: UnknownInputFieldError, argsTree: ArgumentsRenderingTree) {
  const [argParentPath, argName] = splitPath(error.argumentPath)
  const selection = argsTree.arguments.getDeepSubSelectionValue(error.selectionPath)

  if (selection instanceof ObjectValue) {
    selection.getDeepField(error.argumentPath)?.markAsError()
    const argParent = selection.getDeepFieldValue(argParentPath)
    if (argParent instanceof ObjectValue) {
      addInputSuggestions(argParent, error.inputType)
    }
  }

  argsTree.addErrorMessage((chalk) =>
    unknownArgumentMessage(
      chalk,
      argName,
      error.inputType.fields.map((f) => f.name),
    ),
  )
}

function unknownArgumentMessage(chalk: chalk.Chalk, argName: string, options: string[]) {
  const parts = [`Unknown argument ${chalk.redBright(argName)}.`]
  const suggestion = getSuggestion(argName, options)

  if (suggestion) {
    parts.push(`Did you mean \`${chalk.greenBright(suggestion)}\`?`)
  }

  if (options.length > 0) {
    parts.push(availableOptionsMessage(chalk))
  }

  return parts.join(' ')
}

function applyRequiredArgumentMissingError(error: RequiredArgumentMissingError, args: ArgumentsRenderingTree) {
  const argumentName = error.argumentPath[0]
  const objectSuggestion = new SuggestionObjectValue()
  if (error.inputTypes.length === 1 && error.inputTypes[0].kind === 'object') {
    for (const field of error.inputTypes[0].fields) {
      objectSuggestion.addField(field.name, field.typeNames.join(' | '))
    }

    args.arguments.addSuggestion(new ObjectFieldSuggestion(argumentName, objectSuggestion).makeRequired())
  } else {
    const typeName = error.inputTypes.map(getInputTypeName).join(' | ')
    args.arguments.addSuggestion(new ObjectFieldSuggestion(argumentName, typeName).makeRequired())
  }

  args.addErrorMessage((chalk) => `Argument ${chalk.greenBright(argumentName)} is missing.`)
}

function getInputTypeName(description: InputTypeDescription) {
  if (description.kind === 'enum') {
    return 'Enum' // TODO: add name to an enum
  }
  if (description.kind === 'list') {
    return `${getInputTypeName(description.elementType)}[]`
  }
  return description.name
}

function applyInvalidArgumentTypeError(error: InvalidArgumentTypeError, args: ArgumentsRenderingTree) {
  const argName = error.argument.name
  const selection = args.arguments.getDeepSubSelectionValue(error.selectionPath)
  if (selection instanceof ObjectValue) {
    selection.getDeepFieldValue(error.argumentPath)?.markAsError()
  }

  args.addErrorMessage((chalk) => {
    const expected = error.argument.typeNames.map((type) => chalk.greenBright(type)).join(' or ')
    // TODO: print value
    return `Argument ${chalk.bold(argName)}: Invalid value provided. Expected ${expected}, provided ${chalk.redBright(
      error.inferredType,
    )}.`
  })
}

function applyInvalidArgumentValueError(error: InvalidArgumentValueError, args: ArgumentsRenderingTree) {
  const argName = error.argument.name
  const selection = args.arguments.getDeepSubSelectionValue(error.selectionPath)
  if (selection instanceof ObjectValue) {
    selection.getDeepFieldValue(error.argumentPath)?.markAsError()
  }

  args.addErrorMessage((chalk) => {
    const expected = error.argument.typeNames.map((type) => chalk.greenBright(type)).join(' or ')
    return `Invalid value for argument ${chalk.bold(argName)}: ${error.underlyingError}. Expected ${expected}.`
  })
}

function applyUnionError(error: UnionError, args: ArgumentsRenderingTree) {
  const mergedError = tryMergingUnionError(error)
  if (mergedError) {
    applyValidationError(mergedError, args)
    return
  }

  const longestPathError = getLongestPathError(error)

  if (longestPathError) {
    applyValidationError(longestPathError, args)
    return
  }

  args.addErrorMessage(() => 'Unknown error')
}

function tryMergingUnionError({ errors }: UnionError): InvalidArgumentTypeError | undefined {
  if (errors.length === 0 || errors[0].kind !== 'InvalidArgumentType') {
    return undefined
  }
  const result = { ...errors[0], argument: { ...errors[0].argument } }
  for (let i = 1; i < errors.length; i++) {
    const nextError = errors[i]
    if (nextError.kind !== 'InvalidArgumentType') {
      return undefined
    }

    if (!samePath(nextError.selectionPath, result.selectionPath)) {
      return undefined
    }

    if (!samePath(nextError.argumentPath, result.argumentPath)) {
      return undefined
    }

    result.argument.typeNames = result.argument.typeNames.concat(nextError.argument.typeNames)
  }

  return result
}

function samePath(pathA: string[], pathB: string[]): boolean {
  if (pathA.length !== pathB.length) {
    return false
  }
  for (let i = 0; i < pathA.length; i++) {
    if (pathA[i] !== pathB[i]) {
      return false
    }
  }
  return true
}

function getLongestPathError(error: UnionError) {
  return maxBy(error.errors, (error) => {
    let score = 0
    if (Array.isArray(error['selectionPath'])) {
      score += error['selectionPath'].length
    }

    if (Array.isArray(error['argumentPath'])) {
      score += error['argumentPath'].length
    }
    return score
  })
}

function addSelectionSuggestions(selection: ObjectValue, outputType: OutputTypeDescription) {
  for (const field of outputType.fields) {
    if (!selection.hasField(field.name)) {
      selection.addSuggestion(new ObjectFieldSuggestion(field.name, 'true'))
    }
  }
}

function addArgumentsSuggestions(argumentsParent: ObjectValue, args: ArgumentDescription[]) {
  for (const arg of args) {
    if (!argumentsParent.hasField(arg.name)) {
      argumentsParent.addSuggestion(new ObjectFieldSuggestion(arg.name, arg.typeNames.join(' | ')))
    }
  }
}

function addInputSuggestions(parent: ObjectValue, inputType: InputTypeDescription) {
  if (inputType.kind !== 'object') {
    return
  }

  for (const field of inputType.fields) {
    if (!parent.hasField(field.name)) {
      parent.addSuggestion(new ObjectFieldSuggestion(field.name, field.typeNames.join(' | ')))
    }
  }
}

function splitPath(path: string[]): [parentPath: string[], fieldName: string] {
  const selectionPath = [...path]
  const fieldName = selectionPath.pop()
  if (!fieldName) {
    throw new Error('unexpected empty path')
  }
  return [selectionPath, fieldName]
}

function availableOptionsMessage(chalk: chalk.Chalk) {
  return `Available options are listed in ${chalk.greenBright('green')}.`
}

/**
 * Options with edit distance above this value will never be suggested
 */
const MAX_EDIT_DISTANCE = 3

function getSuggestion(str: string, options: string[]): string | undefined {
  let minDistance = Infinity
  let result: string | undefined

  for (const option of options) {
    const editDistance = levenshtein(str, option)
    if (editDistance > MAX_EDIT_DISTANCE) {
      continue
    }
    if (editDistance < minDistance) {
      minDistance = editDistance
      result = option
    }
  }
  return result
}
