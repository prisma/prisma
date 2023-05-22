import { setClassName } from '@prisma/internals/dist/utils/setClassName'
import { green, red, yellow } from 'kleur/colors'

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

export class ExperimentalFlagWithMigrateError extends Error {
  constructor() {
    super(
      `Prisma Migrate was Experimental and is now Generally Available.
${yellow(
  'WARNING this new version has some breaking changes',
)} to use it it's recommended to read the documentation first and remove the ${red('--experimental')} flag.`,
    )
  }
}
setClassName(ExperimentalFlagWithMigrateError, 'ExperimentalFlagWithMigrateError')

export class EarlyAccessFeatureFlagWithMigrateError extends Error {
  constructor() {
    super(
      `Prisma Migrate was in Early Access and is now Generally Available.
Remove the ${red('--early-access-feature')} flag.`,
    )
  }
}
setClassName(EarlyAccessFeatureFlagWithMigrateError, 'EarlyAccessFeatureFlagWithMigrateError')
