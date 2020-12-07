import chalk from 'chalk'
import { RustPanic, sendPanic, link, isCi, logger } from '@prisma/sdk'
import prompt from 'prompts'
import { wouldYouLikeToCreateANewIssue } from './getGithubIssueUrl'

export async function handlePanic(
  error: RustPanic,
  cliVersion: string,
  binaryVersion: string,
): Promise<void> {
  if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
    throw error
  }

  await panicDialog(error, cliVersion, binaryVersion)
}

async function panicDialog(error, cliVersion, binaryVersion) {
  const errorMessage = error.message
    .split('\n')
    .slice(0, Math.max(20, process.stdout.rows))
    .join('\n')

  logger.log(`${chalk.red('Oops, an unexpected error occured!')}
${chalk.red(errorMessage)}

${chalk.bold('Please help us improve Prisma by submitting an error report.')}
${chalk.bold(
  'Error reports never contain personal or other sensitive information.',
)}
${chalk.dim(`Learn more: ${link('https://pris.ly/d/telemetry')}`)}
`)

  const response = await prompt({
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

  const reportFailedMessage = `${chalk.bold.red(
    'Oops. We could not send the error report.',
  )}`

  if (response.value) {
    let reportId: number | void
    try {
      logger.log('Submitting...')
      reportId = await sendPanic(error, cliVersion, binaryVersion)
    } catch (error) {
      logger.log(reportFailedMessage)
    }

    if (reportId) {
      logger.log(
        `\n${chalk.bold(
          `We successfully received the error report id: ${reportId}`,
        )}`,
      )
      logger.log(`\n${chalk.bold('Thanks a lot for your help! 🙏')}`)
    }
  }
  await wouldYouLikeToCreateANewIssue({
    prompt: !response.value,
    error,
    cliVersion,
    binaryVersion,
  })
}
