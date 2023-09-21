import levenshtein from 'js-levenshtein'

import {
  ArgumentDescription,
  EmptySelectionError,
  InputTypeDescription,
  InvalidArgumentTypeError,
  InvalidArgumentValueError,
  OutputTypeDescription,
  RequiredArgumentMissingError,
  SomeFieldsMissingError,
  TooManyFieldsGivenError,
  UnknownArgumentError,
  UnknownInputFieldError,
  UnknownSelectionFieldError,
  ValueTooLargeError,
} from '../engines'
import { IncludeAndSelectError, IncludeOnScalarError, ValidationError } from '../types/ValidationError'
import { applyUnionError } from './applyUnionError'
import { ArgumentsRenderingTree } from './ArgumentsRenderingTree'
import { Colors } from './base'
import { ObjectField } from './ObjectField'
import { ObjectFieldSuggestion } from './ObjectFieldSuggestion'
import { ObjectValue } from './ObjectValue'
import { ScalarValue } from './ScalarValue'
import { SuggestionObjectValue } from './SuggestionObjectValue'

/**
 * Given the validation error and arguments rendering tree, applies corresponding
 * formatting to an error tree and adds all relevant messages.
 *
 * @param error
 * @param args
 */
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
    case 'ValueTooLarge':
      applyValueTooLargeError(error, args)
      break
    case 'SomeFieldsMissing':
      applySomeFieldsMissingError(error, args)
      break
    case 'TooManyFieldsGiven':
      applyTooManyFieldsGivenError(error, args)
      break
    case 'Union':
      applyUnionError(error, args)
      break
    default:
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
    (colors) =>
      `Please ${colors.bold('either')} use ${colors.green('`include`')} or ${colors.green(
        '`select`',
      )}, but ${colors.red('not both')} at the same time.`,
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

  argsTree.addErrorMessage((colors) => {
    let msg = `Invalid scalar field ${colors.red(`\`${field}\``)} for ${colors.bold('include')} statement`
    if (outputType) {
      msg += ` on model ${colors.bold(outputType.name)}. ${availableOptionsMessage(colors)}`
    } else {
      msg += '.'
    }

    msg += `\nNote that ${colors.bold('include')} statements only accept relation fields.`
    return msg
  })
}

function applyEmptySelectionError(error: EmptySelectionError, argsTree: ArgumentsRenderingTree) {
  const outputType = error.outputType
  const selection = argsTree.arguments.getDeepSelectionParent(error.selectionPath)?.value
  const isEmpty = selection?.isEmpty() ?? false

  if (selection) {
    // If selection has fields and we get EmptySelection error, it means all fields within the
    // selection are false. We have 2 possible ways to handle suggestions here:
    //
    // 1. Suggest only the fields, not present inside of the selection. Example:
    //
    // {
    //   select: {
    //     id: false
    //     posts: false,
    // ?   name?: true
    // ?   email?: true
    //  }
    // }
    // There are couple of possible problems here. First, we are assuming that user needs to
    // add new field to the selection, rather than change one of the existing ones to true.
    // Second, we might end up in a situation where all fields are already used in selection and we have nothing left to suggest.
    //
    // 2.Completely ignore users input and suggest all the fields. Example rendering:
    // {
    //  select: {
    //  ?   id?: true
    //  ?   posts?: true,
    //  ?   name?: true
    //  ?   email?: true
    //   }
    //  }
    //
    // So we will be suggesting to either change one of the fields to true, or add a new one which would be true.
    // This is the approach we are taking and in order to it, we need to remove all the fields from selection. Code
    // below will then add them back as a suggestion.
    selection.removeAllFields()
    addSelectionSuggestions(selection, outputType)
  }

  argsTree.addErrorMessage((colors) => {
    if (isEmpty) {
      return `The ${colors.red('`select`')} statement for type ${colors.bold(
        outputType.name,
      )} must not be empty. ${availableOptionsMessage(colors)}`
    }
    return `The ${colors.red('`select`')} statement for type ${colors.bold(outputType.name)} needs ${colors.bold(
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

  argsTree.addErrorMessage((colors) => {
    const parts = [`Unknown field ${colors.red(`\`${fieldName}\``)}`]
    if (selectionParent) {
      parts.push(`for ${colors.bold(selectionParent.kind)} statement`)
    }
    parts.push(`on model ${colors.bold(`\`${error.outputType.name}\``)}.`)
    parts.push(availableOptionsMessage(colors))
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

  argsTree.addErrorMessage((colors) =>
    unknownArgumentMessage(
      colors,
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

  argsTree.addErrorMessage((colors) =>
    unknownArgumentMessage(
      colors,
      argName,
      error.inputType.fields.map((f) => f.name),
    ),
  )
}

function unknownArgumentMessage(colors: Colors, argName: string, options: string[]) {
  const parts = [`Unknown argument \`${colors.red(argName)}\`.`]
  const suggestion = getSuggestion(argName, options)

  if (suggestion) {
    parts.push(`Did you mean \`${colors.green(suggestion)}\`?`)
  }

  if (options.length > 0) {
    parts.push(availableOptionsMessage(colors))
  }

  return parts.join(' ')
}

function applyRequiredArgumentMissingError(error: RequiredArgumentMissingError, args: ArgumentsRenderingTree) {
  let existingField: ObjectField | undefined = undefined

  args.addErrorMessage((colors) => {
    if (existingField?.value instanceof ScalarValue && existingField.value.text === 'null') {
      return `Argument \`${colors.green(argumentName)}\` must not be ${colors.red('null')}.`
    }
    return `Argument \`${colors.green(argumentName)}\` is missing.`
  })
  const selection = args.arguments.getDeepSubSelectionValue(error.selectionPath)
  if (!(selection instanceof ObjectValue)) {
    return
  }

  const [argParent, argumentName] = splitPath(error.argumentPath)
  const objectSuggestion = new SuggestionObjectValue()
  const parent = selection.getDeepFieldValue(argParent)
  if (!(parent instanceof ObjectValue)) {
    return
  }

  existingField = parent.getField(argumentName)
  if (existingField) {
    parent.removeField(argumentName)
  }

  if (error.inputTypes.length === 1 && error.inputTypes[0].kind === 'object') {
    for (const field of error.inputTypes[0].fields) {
      objectSuggestion.addField(field.name, field.typeNames.join(' | '))
    }

    parent.addSuggestion(new ObjectFieldSuggestion(argumentName, objectSuggestion).makeRequired())
  } else {
    const typeName = error.inputTypes.map(getInputTypeName).join(' | ')
    parent.addSuggestion(new ObjectFieldSuggestion(argumentName, typeName).makeRequired())
  }
}

function getInputTypeName(description: InputTypeDescription) {
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

  args.addErrorMessage((colors) => {
    const expected = joinWithPreposition(
      'or',
      error.argument.typeNames.map((type) => colors.green(type)),
    )
    // TODO: print value
    return `Argument \`${colors.bold(argName)}\`: Invalid value provided. Expected ${expected}, provided ${colors.red(
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

  args.addErrorMessage((colors) => {
    const parts = [`Invalid value for argument \`${colors.bold(argName)}\``]
    if (error.underlyingError) {
      parts.push(`: ${error.underlyingError}`)
    }
    parts.push('.')
    if (error.argument.typeNames.length > 0) {
      const expected = joinWithPreposition(
        'or',
        error.argument.typeNames.map((type) => colors.green(type)),
      )
      parts.push(` Expected ${expected}.`)
    }
    return parts.join('')
  })
}

function applyValueTooLargeError(error: ValueTooLargeError, args: ArgumentsRenderingTree) {
  const argName = error.argument.name
  const selection = args.arguments.getDeepSubSelectionValue(error.selectionPath)
  let printedValue: string | undefined
  if (selection instanceof ObjectValue) {
    const field = selection.getDeepField(error.argumentPath)
    const value = field?.value
    value?.markAsError()
    if (value instanceof ScalarValue) {
      printedValue = value.text
    }
  }

  args.addErrorMessage((colors) => {
    const parts: string[] = ['Unable to fit value']
    if (printedValue) {
      parts.push(colors.red(printedValue))
    }
    parts.push(`into a 64-bit signed integer for field \`${colors.bold(argName)}\``)

    return parts.join(' ')
  })
}

function applySomeFieldsMissingError(error: SomeFieldsMissingError, args: ArgumentsRenderingTree) {
  const argumentName = error.argumentPath[error.argumentPath.length - 1]
  const selection = args.arguments.getDeepSubSelectionValue(error.selectionPath)
  if (selection instanceof ObjectValue) {
    const argument = selection.getDeepFieldValue(error.argumentPath)
    if (argument instanceof ObjectValue) {
      addInputSuggestions(argument, error.inputType)
    }
  }

  args.addErrorMessage((colors) => {
    const parts = [`Argument \`${colors.bold(argumentName)}\` of type ${colors.bold(error.inputType.name)} needs`]
    if (error.constraints.minFieldCount === 1) {
      if (error.constraints.requiredFields) {
        parts.push(
          `${colors.green('at least one of')} ${joinWithPreposition(
            'or',
            error.constraints.requiredFields.map((f) => `\`${colors.bold(f)}\``),
          )} arguments.`,
        )
      } else {
        parts.push(`${colors.green('at least one')} argument.`)
      }
    } else {
      parts.push(`${colors.green(`at least ${error.constraints.minFieldCount}`)} arguments.`)
    }
    parts.push(availableOptionsMessage(colors))
    return parts.join(' ')
  })
}

function applyTooManyFieldsGivenError(error: TooManyFieldsGivenError, args: ArgumentsRenderingTree) {
  const argumentName = error.argumentPath[error.argumentPath.length - 1]
  const selection = args.arguments.getDeepSubSelectionValue(error.selectionPath)
  let providedArguments: string[] = []
  if (selection instanceof ObjectValue) {
    const argument = selection.getDeepFieldValue(error.argumentPath)
    if (argument instanceof ObjectValue) {
      argument.markAsError()
      providedArguments = Object.keys(argument.getFields())
    }
  }

  args.addErrorMessage((colors) => {
    const parts = [`Argument \`${colors.bold(argumentName)}\` of type ${colors.bold(error.inputType.name)} needs`]
    if (error.constraints.minFieldCount === 1 && error.constraints.maxFieldCount == 1) {
      parts.push(`${colors.green('exactly one')} argument,`)
    } else if (error.constraints.maxFieldCount == 1) {
      parts.push(`${colors.green('at most one')} argument,`)
    } else {
      parts.push(`${colors.green(`at most ${error.constraints.maxFieldCount}`)} arguments,`)
    }

    parts.push(
      `but you provided ${joinWithPreposition(
        'and',
        providedArguments.map((arg) => colors.red(arg)),
      )}. Please choose`,
    )

    if (error.constraints.maxFieldCount === 1) {
      parts.push('one.')
    } else {
      parts.push(`${error.constraints.maxFieldCount}.`)
    }

    return parts.join(' ')
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

function availableOptionsMessage({ green, enabled }: Colors) {
  return `Available options are ` + (enabled ? `listed in ${green('green')}` : `marked with ?`) + '.'
}

function joinWithPreposition(preposition: 'and' | 'or', items: string[]): string {
  if (items.length === 1) {
    return items[0]
  }
  const itemsCopy = [...items]
  const lastItem = itemsCopy.pop()
  return `${itemsCopy.join(', ')} ${preposition} ${lastItem}`
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
