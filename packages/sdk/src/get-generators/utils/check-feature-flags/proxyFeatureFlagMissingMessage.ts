import chalk from 'chalk'
import { highlightDatamodel } from '../../../highlight/highlight'
import { link } from '../../../utils/link'

export const proxyFeatureFlagMissingMessage = `\nIn order to use the ${chalk.bold('dataproxy')} engine,
you need to set the ${chalk.green('dataProxy')} feature flag.
You can define the feature flag like this:

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
