import chalk from 'chalk'
import { highlightDatamodel } from '../../../highlight/highlight'
import { link } from '../../../link'

export const mongoFeatureFlagMissingMessage = `\nIn order to use the ${chalk.bold(
  'mongodb',
)} provider,
you need to set the ${chalk.green('mongodb')} feature flag.
You can define the feature flag like this:

${chalk.bold(
  highlightDatamodel(`generator client {
    provider = "prisma-client-js"
    previewFeatures = ["mongoDb"]
}`),
)}

More information in our documentation:
${link('https://pris.ly/d/prisma-schema')}
`
