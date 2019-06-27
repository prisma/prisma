import chalk from 'chalk'

/**
 * Unknown command
 */
export function unknownCommand(helpTemplate: string, cmd: string): HelpError {
  return new HelpError(
    `\n${chalk.bold.red(`!`)} Unknown command "${cmd}"\n${helpTemplate}`,
  )
}

/**
 * Custom help error used to display help
 * errors without printing a stack trace
 */
export class HelpError extends Error {
  constructor(msg: string) {
    super(msg)
    // setPrototypeOf is needed for custom errors to work
    Object.setPrototypeOf(this, HelpError.prototype)
  }
}
