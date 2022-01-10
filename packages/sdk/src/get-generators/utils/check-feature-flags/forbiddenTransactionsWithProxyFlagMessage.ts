import chalk from 'chalk'
import { highlightDatamodel } from '../../../highlight/highlight'
import { link } from '../../../link'

export const forbiddenTransactionsWithProxyFlagMessage = `\nInteractive Transactions are not supported in the Data Proxy (${chalk.green(
  'dataProxy',
)} feature flag).
Skip the ${chalk.red('interactiveTransactions')} flag:

${chalk.bold(
  highlightDatamodel(`generator client {
    provider = "prisma-client-js"
    previewFeatures = ["dataProxy"]
}`),
)}
`

// TODO
// More information in our documentation:
// ${link('https://pris.ly/d/prisma-schema')}
