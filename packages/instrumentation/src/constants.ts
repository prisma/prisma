import packageJson from '../package.json'

export const VERSION = packageJson.version

const majorVersion = VERSION.split('.')[0]

export const GLOBAL_INSTRUMENTATION_ACCESSOR_KEY = 'PRISMA_INSTRUMENTATION'
export const GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY = `V${majorVersion}_PRISMA_INSTRUMENTATION`

export const NAME = packageJson.name

export const MODULE_NAME = '@vetching-corporation/prisma-client'
