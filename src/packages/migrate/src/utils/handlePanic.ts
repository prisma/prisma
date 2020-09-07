import chalk from 'chalk'
import { RustPanic, sendPanic, link } from '@prisma/sdk'
import isCi from 'is-ci'
import prompt from 'prompts'

export async function handlePanic(
  error: RustPanic,
  cliVersion: string,
  binaryVersion: string,
): Promise<boolean> {
  return new Promise(async function (resolve, reject) {
    if (!process.stdout.isTTY || isCi || process.env.GITHUB_ACTIONS) {
      return reject(error)
    }

    await panicDialog(error, cliVersion, binaryVersion)

    return resolve()
  })
}

async function panicDialog(error, cliVersion, binaryVersion) {
  const errorMessage = error.message
    .split('\n')
    .slice(0, Math.max(20, process.stdout.rows))
    .join('\n')

  console.log(`${chalk.red('Oops, an unexpected error occured!')}
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
  )}
  ${chalk.bold(
    `To help us still receive this error, please create an issue in ${link(
      'https://github.com/prisma/prisma/issues/new',
    )}`,
  )}`

  if (response.value) {
    let reportId: number | void
    try {
      console.log('Submitting...')
      reportId = await sendPanic(error, cliVersion, binaryVersion)
    } catch (error) {
      console.log(reportFailedMessage)
    }

    if (reportId) {
      console.log(
        `\n${chalk.bold('We successfully received the error report.')}

${chalk.bold(
  `To help us even more, please create an issue at ${link(
    'https://github.com/prisma/prisma/issues/new',
  )}\nMentioning the ${chalk.underline(`report id ${reportId}`)}.`,
)}`,
      )
    } else {
      console.log(reportFailedMessage)
    }
    console.log(`\n${chalk.bold('Thanks a lot for your help! 🙏')}`)
  }
}
