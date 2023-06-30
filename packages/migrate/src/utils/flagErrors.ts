import { setClassName } from '@prisma/internals/dist/utils/setClassName'
import { green } from 'kleur/colors'

export class ExperimentalFlagError extends Error {
  constructor() {
    super(`Please provide the ${green('--experimental')} flag to use this command.`)
  }
}

setClassName(ExperimentalFlagError, 'ExperimentalFlagError')

export class PreviewFlagError extends Error {
  constructor() {
    super(
      `This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
Please provide the ${green('--preview-feature')} flag to use this command.`,
    )
  }
}
setClassName(PreviewFlagError, 'PreviewFlagError')

export class EarlyAccessFlagError extends Error {
  constructor() {
    super(
      `This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
Please provide the ${green('--early-access-feature')} flag to use this command.`,
    )
  }
}
setClassName(EarlyAccessFlagError, 'EarlyAccessFlagError')
