export { generatorHandler } from './generatorHandler'
export { GeneratorError, GeneratorProcess } from './GeneratorProcess'

/**
 * Exported for backwards compatibility only.
 *
 * @deprecated Generators using `@prisma/generator-helper` shouldn't need JSON-RPC internals.
 */
export type * as JsonRPC from './json-rpc'

/**
 * A re-export for backwards compatibility with community generators.
 *
 * @deprecated Use the `@prisma/dmmf` package instead.
 */
export type * as DMMF from '@prisma/dmmf'

/**
 * A re-export for backwards compatibility with community generators.
 *
 * @deprecated Use the `@prisma/generator` package instead.
 */
export type * from '@prisma/generator'
