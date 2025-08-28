import { deserializeJsonResponse } from './json-protocol'
import { QueryPlanNode } from './query-plan'
import { UserFacingError } from './user-facing-error'
import { doKeysMatch } from './utils'

export type BatchResponse = MultiBatchResponse | CompactedBatchResponse

export type MultiBatchResponse = {
  type: 'multi'
  plans: QueryPlanNode[]
}

export type CompactedBatchResponse = {
  type: 'compacted'
  plan: QueryPlanNode
  arguments: Record<string, {}>[]
  nestedSelection: string[]
  keys: string[]
  expectNonEmpty: boolean
}

/**
 * Converts the result of a compacted query back to result objects analogous to what queries
 * would return when executed individually.
 */
export function convertCompactedRows(rows: {}[], compiledBatch: CompactedBatchResponse): unknown[] {
  // a list of objects that contain the keys of every row
  const keysPerRow = rows.map((item) =>
    compiledBatch.keys.reduce((acc, key) => {
      acc[key] = deserializeJsonResponse(item[key])
      return acc
    }, {}),
  )

  // the selections inferred from the request, used to filter unwanted columns from the results
  const selection = new Set(compiledBatch.nestedSelection)

  return compiledBatch.arguments.map((args) => {
    // we find the index of the row that matches the input arguments - this is the row we want
    // to return minus any extra columns not present in the selection
    const rowIndex = keysPerRow.findIndex((rowKeys) => doKeysMatch(rowKeys, args))
    if (rowIndex === -1) {
      if (compiledBatch.expectNonEmpty) {
        return new UserFacingError(
          'An operation failed because it depends on one or more records that were required but not found',
          'P2025',
        )
      } else {
        return null
      }
    } else {
      const selected = Object.entries(rows[rowIndex]).filter(([k]) => selection.has(k))
      return Object.fromEntries(selected)
    }
  })
}
