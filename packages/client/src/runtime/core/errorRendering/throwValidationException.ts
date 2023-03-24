import chalk from 'chalk'

import { Writer } from '../../../generation/ts-builders/Writer'
import { ErrorFormat } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import { CallSite } from '../../utils/CallSite'
import { createErrorMessageWithContext } from '../../utils/createErrorMessageWithContext'
import { JsArgs } from '../types/JsApi'
import { ValidationError } from '../types/ValidationError'
import { applyValidationError } from './applyValidationError'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'

type ExceptionParams = {
  errors: ValidationError[]
  args: JsArgs
  callsite?: CallSite
  originalMethod: string
  errorFormat: ErrorFormat
}

export function throwValidationException({
  args,
  errors,
  errorFormat,
  callsite,
  originalMethod,
}: ExceptionParams): never {
  const argsTree = buildArgumentsRenderingTree(args)
  for (const error of errors) {
    applyValidationError(error, argsTree)
  }

  const chalkInstance = new chalk.Instance()
  if (errorFormat !== 'pretty') {
    chalkInstance.level = 0
  }
  const message = argsTree.renderAllMessages(chalkInstance)
  const renderedArgs = new Writer(0, { chalk: chalkInstance }).write(argsTree).toString()

  const messageWithContext = createErrorMessageWithContext({
    message,
    callsite,
    originalMethod,
    showColors: errorFormat === 'pretty',
    callArguments: renderedArgs,
  })

  throw new PrismaClientValidationError(messageWithContext)
}
