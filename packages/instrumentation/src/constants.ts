const { version, name } = require('../package.json')

const majorVersion = version.split('.')[0]

export const VERSION = version as string

export const GLOBAL_INSTRUMENTATION_ACCESSOR_KEY = 'PRISMA_INSTRUMENTATION'
export const GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY = `V${majorVersion}_PRISMA_INSTRUMENTATION`

export const NAME = name as string

export const MODULE_NAME = '@prisma/client'
