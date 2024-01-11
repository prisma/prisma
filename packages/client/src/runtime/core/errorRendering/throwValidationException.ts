import { Writer } from '../../../generation/ts-builders/Writer'
import { ErrorFormat } from '../../getPrismaClient'
import { CallSite } from '../../utils/CallSite'
import { createErrorMessageWithContext } from '../../utils/createErrorMessageWithContext'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
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
