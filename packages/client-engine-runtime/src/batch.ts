import { deserializeJsonObject } from './json-protocol'
import type { PrismaValuePlaceholder, QueryPlanNode } from './query-plan'
import { getPrismaValuePlaceholderName, isPrismaValuePlaceholder } from './query-plan'
import { UserFacingError } from './user-facing-error'
import { doKeysMatch, doKeyValuesMatch } from './utils'

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

type QueryProtocolPlaceholder = { $type: 'Param'; value: { name: string } }
type Placeholder = QueryProtocolPlaceholder | PrismaValuePlaceholder

/**
 * Checks if a value is a placeholder.
 * Handles both query-protocol `{ $type: 'Param', value: { name: '...' } }`
 * and query-plan placeholder formats.
 */
function isPlaceholder(value: unknown): value is Placeholder {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const obj = value as Record<string, unknown>
  if ('$type' in obj && obj.$type === 'Param') {
    const placeholderValue = obj.value
    return (
      typeof placeholderValue === 'object' &&
      placeholderValue !== null &&
      typeof (placeholderValue as Record<string, unknown>).name === 'string'
    )
  }
  return isPrismaValuePlaceholder(value)
}

function getPlaceholderName(value: Placeholder): string {
  if (isPrismaValuePlaceholder(value)) {
    return getPrismaValuePlaceholderName(value)
  }
  return value.value.name
}

function resolveArgPlaceholders(
  args: Record<string, {}>,
  placeholderValues: Record<string, unknown>,
): Record<string, {}> {
  const resolved: Record<string, {}> = {}
  for (const [key, value] of Object.entries(args)) {
    resolved[key] = value
    if (isPlaceholder(value)) {
      const placeholderName = getPlaceholderName(value)
      if (placeholderName in placeholderValues) {
        resolved[key] = placeholderValues[placeholderName] as {}
      }
    }
  }
  return resolved
}

/**
 * Converts the result of a compacted query back to result objects analogous to what queries
 * would return when executed individually.
 */
export function convertCompactedRows(
  rows: {}[],
  compiledBatch: CompactedBatchResponse,
  placeholderValues: Record<string, unknown> = {},
): unknown[] {
  if (compiledBatch.keys.length === 1) {
    const converted = convertSingleKeyCompactedRows(rows, compiledBatch, placeholderValues)
    if (converted !== undefined) {
      return converted
    }
  }

  return convertCompactedRowsGeneric(rows, compiledBatch, placeholderValues)
}

function convertCompactedRowsGeneric(
  rows: {}[],
  compiledBatch: CompactedBatchResponse,
  placeholderValues: Record<string, unknown> = {},
): unknown[] {
  // a list of objects that contain the keys of every row
  const keysPerRow = rows.map((item) =>
    compiledBatch.keys.reduce((acc, key) => {
      acc[key] = deserializeJsonObject(item[key])
      return acc
    }, {}),
  )

  // the selections inferred from the request, used to filter unwanted columns from the results
  const selection = new Set(compiledBatch.nestedSelection)

  return compiledBatch.arguments.map((args) => {
    const resolvedArgs = resolveArgPlaceholders(args, placeholderValues)

    // we find the index of the row that matches the input arguments - this is the row we want
    // to return minus any extra columns not present in the selection
    const rowIndex = keysPerRow.findIndex((rowKeys) => doKeysMatch(rowKeys, resolvedArgs))
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

function convertSingleKeyCompactedRows(
  rows: {}[],
  compiledBatch: CompactedBatchResponse,
  placeholderValues: Record<string, unknown>,
): unknown[] | undefined {
  const key = compiledBatch.keys[0]
  const selection = compiledBatch.nestedSelection
  const expectedValues = new Array(compiledBatch.arguments.length)

  for (let i = 0; i < compiledBatch.arguments.length; i++) {
    const args = compiledBatch.arguments[i]
    if (!Object.hasOwn(args, key)) {
      return undefined
    }
    expectedValues[i] = resolveArgValue(args[key], placeholderValues)
  }

  const rowKeyValues = new Array(rows.length)
  for (let i = 0; i < rows.length; i++) {
    rowKeyValues[i] = deserializeJsonObject(rows[i][key])
  }

  return expectedValues.map((expectedValue) => {
    let row: {} | undefined

    for (let i = 0; i < rows.length; i++) {
      if (doKeyValuesMatch(rowKeyValues[i], expectedValue)) {
        row = rows[i]
        break
      }
    }

    if (row === undefined) {
      if (compiledBatch.expectNonEmpty) {
        return new UserFacingError(
          'An operation failed because it depends on one or more records that were required but not found',
          'P2025',
        )
      }
      return null
    }

    const selected: Record<string, unknown> = {}
    for (let i = 0; i < selection.length; i++) {
      const field = selection[i]
      selected[field] = row[field]
    }
    return selected
  })
}

function resolveArgValue(value: {}, placeholderValues: Record<string, unknown>): unknown {
  if (isPlaceholder(value)) {
    const placeholderName = getPlaceholderName(value)
    if (placeholderName in placeholderValues) {
      return placeholderValues[placeholderName]
    }
  }

  return value
}
