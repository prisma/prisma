const { version, name } = require('../package.json')

export const GLOBAL_KEY = 'PRISMA_INSTRUMENTATION'

export const VERSION = version as string

export const NAME = name as string

export const MODULE_NAME = 'prisma'
