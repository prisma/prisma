import { bold, red } from 'kleur/colors'

/**
 * Unknown command
 */
export function unknownCommand(helpTemplate: string, cmd: string): HelpError {
  return new HelpError(`\n${bold(red(`!`))} Unknown command "${cmd}"\n${helpTemplate}`)
}

/**
 * Custom help error used to display help
 * errors without printing a stack trace
 */
export class HelpError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'HelpError'
    // setPrototypeOf is needed for custom errors to work
    Object.setPrototypeOf(this, HelpError.prototype)
  }
}
