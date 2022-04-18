import chalk from 'chalk'
import didYouMean from 'didyoumean'

import type { Commands } from './types'

/**
 * Unknown command
 */
export function unknownCommandWithSuggestion(cmds: Commands, helpTemplate: string, cmd: string): HelpError {
  const cmdsList = Object.keys(cmds)

  // Default fuzziness Threshold is 0.4
  // Edit the threshold like this: `didYouMean.threshold = 0.2`
  // This function is typed incorrectly the correct return type is `string | null` not `string | string[]`
  const suggestion = didYouMean(cmd, cmdsList) as string | null

  // Check if the command matched one of the commands list and met at the matching treshold
  // Otherwise show the help template
  if (suggestion) {
    return new HelpError(
      `\n${chalk.bold.red(`!`)} Unknown command "${cmd}"\n\nDid you mean this?\n  ${chalk.cyan(
        '$',
      )} prisma ${suggestion}\n\nTo see a list of supported prisma commands, run:\n  prisma --help`,
    )
  } else {
    return unknownCommand(helpTemplate, cmd)
  }
}

/**
 * Unknown command
 */
export function unknownCommand(helpTemplate: string, cmd: string): HelpError {
  return new HelpError(`\n${chalk.bold.red(`!`)} Unknown command "${cmd}"\n${helpTemplate}`)
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
