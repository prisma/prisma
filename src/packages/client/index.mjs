import path from 'path'
import { fileURLToPath } from 'url'

export * from '.prisma/client/index.mjs'

/**
 * Polyfill __dirname for esm modules
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Annotation for ncc/zeit
 */
path.join(__dirname, '../../.prisma/client/schema.prisma')
path.join(__dirname, '../../../.prisma/client/schema.prisma')
path.join(__dirname, '../../../../.prisma/client/schema.prisma')
