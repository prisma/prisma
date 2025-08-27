import * as ts from '@prisma/ts-builders'

import { Enum } from '../Enum'
import { GenerateContext } from '../GenerateContext'

const jsDocHeader = `/*
 * WARNING: This is an internal file that is subject to change!
 *
 * 🛑 Under no circumstances should you import this file directly! 🛑
 *
 * All exports from this file are wrapped under a \`Prisma\` namespace object in the browser.ts file.
 * While this enables partial backward compatibility, it is not part of the stable public API.
 *
 * If you are looking for your Models, Enums, and Input Types, please import them from the respective
 * model files in the \`model\` directory!
 */
`
export function createPrismaNamespaceBrowserFile(context: GenerateContext): string {
  const imports = [ts.moduleImport(`${context.runtimeBase}/index-browser`).asNamespace('runtime')].map((i) =>
    ts.stringify(i),
  )

  const prismaEnums = context.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toTS())

  return `${jsDocHeader}
${imports.join('\n')}

export type * from '${context.importFileName(`../models`)}'
export type * from '${context.importFileName(`./prismaNamespace`)}'

export const Decimal = runtime.Decimal

export const NullTypes = {
  DbNull: runtime.objectEnumValues.classes.DbNull as (new (secret: never) => typeof runtime.objectEnumValues.instances.DbNull),
  JsonNull: runtime.objectEnumValues.classes.JsonNull as (new (secret: never) => typeof runtime.objectEnumValues.instances.JsonNull),
  AnyNull: runtime.objectEnumValues.classes.AnyNull as (new (secret: never) => typeof runtime.objectEnumValues.instances.AnyNull),
}

/**
 * Helper for filtering JSON entries that have \`null\` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export const DbNull = runtime.objectEnumValues.instances.DbNull

/**
 * Helper for filtering JSON entries that have JSON \`null\` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export const JsonNull = runtime.objectEnumValues.instances.JsonNull

/**
 * Helper for filtering JSON entries that are \`Prisma.DbNull\` or \`Prisma.JsonNull\`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export const AnyNull = runtime.objectEnumValues.instances.AnyNull

${new Enum(
  {
    name: 'ModelName',
    values: context.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toTS()}

/**
 * Enums
 */

${prismaEnums?.join('\n\n')}
`
}
