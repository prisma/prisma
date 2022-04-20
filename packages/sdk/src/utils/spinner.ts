import type { Options as OraOptions } from 'ora'
import ora from 'ora'

const defaultOraOptions: OraOptions = {
  spinner: 'dots',
  color: 'cyan',
  indent: 0,
  stream: process.stdout,
}

/**
 * Methods available to a spinner instance that has already started.
 */
export interface SpinnerStarted {
  success(text?: string): void
  failure(text?: string): void
}

/**
 * Closure that starts a spinner if `enableOutput` is true, and returns a `SpinnerStarted` instance.
 * @param enableOutput Whether to enable or disable any output. Useful e.g. for "--print" flags in commands.
 * @param oraOptions Additional options to pass to `ora` for customizing the spinner.
 * @returns
 */
export function createSpinner(enableOutput = true, oraOptions: Partial<OraOptions> = {}) {
  return (text: string): SpinnerStarted => {
    if (!enableOutput) {
      return {
        success: () => {},
        failure: () => {},
      }
    }

    const actualOptions = { ...defaultOraOptions, ...oraOptions }
    actualOptions.stream?.write('\n')
    const spinner = ora(actualOptions)
    spinner.start(text)

    return {
      /**
       * Stop the spinner, change it to a green ✔ and persist the current text, or text if provided.
       * @param textSuccess Will persist text if provided.
       */
      success: (textSuccess) => {
        spinner.succeed(textSuccess)
      },

      /**
       * Stop the spinner, change it to a red ✖ and persist the current text, or text if provided.
       * @param textFailure Will persist text if provided.
       */
      failure: (textFailure) => {
        spinner.fail(textFailure)
      },
    }
  }
}
