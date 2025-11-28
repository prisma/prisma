/**
 * Information about a single Prisma query.
 */
export interface SqlCommenterSingleQueryInfo {
  /**
   * The model name (e.g., "User", "Post"). Undefined for raw queries.
   */
  modelName?: string

  /**
   * The Prisma operation (e.g., "findMany", "createOne", "queryRaw").
   */
  action: string

  /**
   * The full query object (selection, arguments, etc.).
   */
  query: unknown
}

/**
 * Information about the query or queries being executed.
 *
 * - `single`: A single query is being executed
 * - `compacted`: Multiple queries have been compacted into a single SQL statement
 *   (e.g., automatic batching of findUnique queries, or explicit $transaction batches)
 */
export type SqlCommenterQueryInfo =
  | ({ type: 'single' } & SqlCommenterSingleQueryInfo)
  | { type: 'compacted'; queries: SqlCommenterSingleQueryInfo[] }

/**
 * Context provided to SQL commenter plugins.
 */
export interface SqlCommenterContext {
  /**
   * Information about the Prisma query being executed.
   */
  query: SqlCommenterQueryInfo
}

/**
 * A SQL commenter plugin that returns key-value pairs to be added as comments.
 * Return an empty object to add no comments.
 *
 * @example
 * ```ts
 * const myPlugin: SqlCommenterPlugin = (context) => {
 *   return {
 *     application: 'my-app',
 *     model: context.query.type === 'single' ? context.query.modelName ?? 'raw' : 'batch',
 *   }
 * }
 * ```
 */
export interface SqlCommenterPlugin {
  (context: SqlCommenterContext): Record<string, string>
}
