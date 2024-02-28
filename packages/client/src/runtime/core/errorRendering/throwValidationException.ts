import { Writer } from '../../../generation/ts-builders/Writer'
import { ErrorFormat } from '../../getPrismaClient'
import { CallSite } from '../../utils/CallSite'
import { createErrorMessageWithContext } from '../../utils/createErrorMessageWithContext'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
import { SerializableError } from '../errors/utils/deserializeErrorMessage'
import { serializeErrorMessage } from '../errors/utils/serializeErrorMessage'
import { JsArgs } from '../types/exported/JsApi'
import { ValidationError } from '../types/ValidationError'
import { applyValidationError } from './applyValidationError'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'
import { activeColors, inactiveColors } from './base'

type ExceptionParams = {
  errors: ValidationError[]
  args: JsArgs
  callsite?: CallSite
  originalMethod: string
  errorFormat: ErrorFormat
  clientVersion: string
}

export function throwValidationException({
  args,
  errors,
  errorFormat,
  callsite,
  originalMethod,
  clientVersion,
}: ExceptionParams): never {
  if (TARGET_BUILD_TYPE === 'wasm') {
    const input = { args, errors, errorFormat, originalMethod, clientVersion }
    const message = serializeErrorMessage(SerializableError.THROW_VALIDATION_EXCEPTION, input)

    throw new PrismaClientValidationError(message, { clientVersion })
  } else {
    const argsTree = buildArgumentsRenderingTree(args)

    for (const error of errors) {
      applyValidationError(error, argsTree)
    }

    const colors = errorFormat === 'pretty' ? activeColors : inactiveColors
    const message = argsTree.renderAllMessages(colors)
    const renderedArgs = new Writer(0, { colors }).write(argsTree).toString()
    const messageWithContext = createErrorMessageWithContext({
      message,
      callsite,
      originalMethod,
      showColors: errorFormat === 'pretty',
      callArguments: renderedArgs,
    })

    throw new PrismaClientValidationError(messageWithContext, { clientVersion })
  }
}
