/**
 * An object like a record from the database.
 */
export type PrismaObject = Record<string, unknown>

/**
 * The general type of values each node can evaluate to.
 */
export type Value = unknown

/**
 * Environment in which a query plan node is interpreted. The names may come
 * from the query placeholders or from let bindings introduced in the query plan.
 */
export type Env = Record<string, unknown>
