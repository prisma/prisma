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
      Please provide the ${chalk.green('--preview')} flag to use this command.`,
    )
  }
}
