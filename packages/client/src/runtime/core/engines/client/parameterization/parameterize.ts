/**
 * Query parameterization logic for query plan caching.
 *
 * This module handles the conversion of Prisma queries into parameterized shapes
 * where user data values are replaced with placeholder markers, while extracting
 * the actual values into a separate map.
 *
 * Parameterization uses the ParamGraph (DMMF-derived schema) for precise,
 * schema-aware parameterization.
 */

import type { JsonBatchQuery, JsonQuery } from '@prisma/json-protocol'

import { parameterizeBatchWithSchema, parameterizeQueryWithSchema, type ParamGraphView } from '.'

export type { ParamGraphView } from '.'

export interface ParameterizeResult {
  parameterizedQuery: JsonQuery
  placeholderValues: Record<string, unknown>
}

export interface ParameterizeBatchResult {
  parameterizedBatch: JsonBatchQuery
  placeholderValues: Record<string, unknown>
}

/**
 * Parameterizes a query object, replacing all user data values with placeholders
 * and extracting the actual values into a separate map.
 *
 * @param query - The query object to parameterize
 * @param view - ParamGraphView for schema-aware parameterization
 * @returns An object containing the parameterized query, placeholder values map, and paths array
 */
export function parameterizeQuery(query: JsonQuery, view: ParamGraphView): ParameterizeResult {
  return parameterizeQueryWithSchema(query, view)
}

/**
 * Parameterizes a batch request, replacing all user data values with placeholders
 * and extracting the actual values into a single combined map.
 *
 * Placeholder names are prefixed with the query index to ensure uniqueness across
 * all queries in the batch (e.g., `batch[0].query.arguments.where.id`).
 *
 * @param batch - The batch request to parameterize
 * @param view - ParamGraphView for schema-aware parameterization
 * @returns An object containing the parameterized batch and combined placeholder values/paths
 */
export function parameterizeBatch(batch: JsonBatchQuery, view: ParamGraphView): ParameterizeBatchResult {
  return parameterizeBatchWithSchema(batch, view)
}
