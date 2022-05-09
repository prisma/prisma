import chalk from 'chalk'
import prompt from 'prompts'

import type { RustPanic } from '../panic'
import { sendPanic } from '../sendPanic'
import { wouldYouLikeToCreateANewIssue } from './getGithubIssueUrl'
import { isCi } from './isCi'
import { link } from './link'

export async function handlePanic(
  error: RustPanic,
  cliVersion: string,
  engineVersion: string,
  command: string,
): Promise<void> {
  if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
    throw error
  }

  await panicDialog(error, cliVersion, engineVersion, command)
}

async function panicDialog(
  error: RustPanic,
  cliVersion: string,
  engineVersion: string,
  command: string,
): Promise<void> {
  const errorMessage = error.message.split('\n').slice(0, Math.max(20, process.stdout.rows)).join('\n')

  console.log(`${chalk.red('Oops, an unexpected error occured!')}
${chalk.red(errorMessage)}

${chalk.bold('Please help us improve Prisma by submitting an error report.')}
${chalk.bold('Error reports never contain personal or other sensitive information.')}
${chalk.dim(`Learn more: ${link('https://pris.ly/d/telemetry')}`)}
`)

  const { value: shouldSubmitReport } = await prompt({
    type: 'select',
    name: 'value',
    message: 'Submit error report',
    initial: 0,
    choices: [
      {
        title: 'Yes',
        value: true,
        description: `Send error report once`,
      },
      {
        title: 'No',
        value: false,
        description: `Don't send error report`,
      },
    ],
  })

  if (shouldSubmitReport) {
    try {
      console.log('Submitting...')
      const reportId = await sendPanic(error, cliVersion, engineVersion)
      console.log(`\n${chalk.bold(`We successfully received the error report id: ${reportId}`)}`)
      console.log(`\n${chalk.bold('Thanks a lot for your help! 🙏')}`)
    } catch (error) {
      // TODO: we should report why we're not able to submit an error report
      const reportFailedMessage = `${chalk.bold.red('Oops. We could not send the error report.')}`
      console.log(reportFailedMessage)
    }
  }

  await wouldYouLikeToCreateANewIssue({
    prompt: !shouldSubmitReport,
    error,
    cliVersion,
    engineVersion,
    command,
  })
}
