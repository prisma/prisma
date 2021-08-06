import chalk from 'chalk'

export class ExperimentalFlagError extends Error {
  constructor() {
    super(
      `Please provide the ${chalk.green(
        '--experimental',
      )} flag to use this command.`,
    )
  }
}

export class PreviewFlagError extends Error {
  constructor() {
    super(
      `This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
Please provide the ${chalk.green(
        '--preview-feature',
      )} flag to use this command.`,
    )
  }
}

export class EarlyAcessFlagError extends Error {
  constructor() {
    super(
      `This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
Please provide the ${chalk.green(
        '--early-access-feature',
      )} flag to use this command.`,
    )
  }
}

export class ExperimentalFlagWithNewMigrateError extends Error {
  constructor() {
    super(
      `Prisma Migrate was Experimental and is now Generally Available.
${chalk.yellow(
  'WARNING this new version has some breaking changes',
)} to use it it's recommended to read the documentation first and remove the ${chalk.red(
        '--experimental',
      )} flag.`,
    )
  }
}

export class EarlyAccessFeatureFlagWithNewMigrateError extends Error {
  constructor() {
    super(
      `Prisma Migrate was in Early Access and is now in Preview.
Replace the ${chalk.red('--early-access-feature')} flag with ${chalk.green(
        '--preview-feature',
      )}.`,
    )
  }
}
