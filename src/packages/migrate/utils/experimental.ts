import chalk from 'chalk'

export class ExperimentalFlagError extends Error {
  constructor() {
    super(`Please provide the ${chalk.green('--experimental')} flag to use this command.`)
  }
}
