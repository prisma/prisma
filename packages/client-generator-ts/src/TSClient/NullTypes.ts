export const nullTypes = `
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
`
