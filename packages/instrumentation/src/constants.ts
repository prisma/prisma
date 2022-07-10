const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

export const GLOBAL_KEY = 'PRISMA_INSTRUMENTATION'

export const VERSION = packageJson.version as string

export const NAME = packageJson.name as string

export const MODULE_NAME = 'prisma'
