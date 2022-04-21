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
  const actualOptions = { ...defaultOraOptions, ...oraOptions }

  return (text: string): SpinnerStarted => {
    if (!enableOutput) {
      return {
        success: () => {},
        failure: () => {},
      }
    }

    actualOptions.stream?.write('\n')

    /**
     * Ships the mocks with the actual implementation in order to have sane jest snapshots.
     * This is a workaround because jest doesn't support mocking classes.
     */
    if (process.env.NODE_ENV === 'test' || process.env.CI) {
      actualOptions.stream?.write(`(spinner) ${text}\n`)
      return {
        success: (textSuccess) => {
          actualOptions.stream?.write(`(spinner ✔) ${textSuccess ?? text}\n`)
        },
        failure: (textFailure) => {
          actualOptions.stream?.write(`(spinner ✖) ${textFailure ?? text}\n`)
        },
      }
    }

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
