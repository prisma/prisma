export const nullTypes = `
export const NullTypes = {
  DbNull: utilities.objectEnumValues.classes.DbNull as (new (secret: never) => typeof utilities.objectEnumValues.instances.DbNull),
  JsonNull: utilities.objectEnumValues.classes.JsonNull as (new (secret: never) => typeof utilities.objectEnumValues.instances.JsonNull),
  AnyNull: utilities.objectEnumValues.classes.AnyNull as (new (secret: never) => typeof utilities.objectEnumValues.instances.AnyNull),
}

/**
 * Helper for filtering JSON entries that have \`null\` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export const DbNull = utilities.objectEnumValues.instances.DbNull

/**
 * Helper for filtering JSON entries that have JSON \`null\` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export const JsonNull = utilities.objectEnumValues.instances.JsonNull

/**
 * Helper for filtering JSON entries that are \`Prisma.DbNull\` or \`Prisma.JsonNull\`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export const AnyNull = utilities.objectEnumValues.instances.AnyNull
`
