import { maxWithComparator } from '@prisma/internals'

import type { EngineValidationError, InvalidArgumentTypeError, UnionError } from '../engines'
import type { GlobalOmitOptions } from '../jsonProtocol/serializeJsonQuery'
import { applyValidationError } from './applyValidationError'
import type { ArgumentsRenderingTree } from './ArgumentsRenderingTree'

type NonUnionError = Exclude<EngineValidationError, UnionError>

/**
 * When a particular field has multiple allowed types on the schema level
 * and none of them match users input, engine returns special kind of error: UnionError.
 * This error acts as a container for individual errors for each non-matching type.
 * In that case, we need to make a guess which of the errors corresponds users intent the most.
 * General algorithm of processing them is the following:
 * - flatten all nested errors and get a single list of all possible errors
 * - merge individual InvalidArgumentType errors at the same path
 * - pick the best error based on combined argument and selection paths length and type of the error.
 *
 * For details of each step, see other comments in this file.
 * @param error
 * @param args
 */
export function applyUnionError(error: UnionError, args: ArgumentsRenderingTree, globalOmit?: GlobalOmitOptions) {
  const allErrors = flattenUnionError(error)
  const merged = mergeInvalidArgumentTypeErrors(allErrors)
  const bestError = getBestScoringError(merged)
  if (bestError) {
    applyValidationError(bestError, args, globalOmit)
  } else {
    args.addErrorMessage(() => 'Unknown error')
  }
}

function flattenUnionError(error: UnionError): NonUnionError[] {
  return error.errors.flatMap((error) => {
    if (error.kind === 'Union') {
      return flattenUnionError(error)
    }
    return [error]
  })
}

/**
 * Iterates over provided error list and merges all InvalidArgumentType
 * with matching selectionPath and argumentPath into one. For example,
 * if the list has an error, saying that `where.arg` does not match `Int`
 * and another, saying that `where.arg` does not match IntFilter, resulting
 * list will contain a single error for `where.arg` saying it does not
 * match `Int | IntFilter`
 * @param errorList
 * @returns
 */
function mergeInvalidArgumentTypeErrors(errorList: NonUnionError[]) {
  const invalidArgsError = new Map<string, InvalidArgumentTypeError>()
  const result: NonUnionError[] = []

  for (const error of errorList) {
    if (error.kind !== 'InvalidArgumentType') {
      result.push(error)
      continue
    }

    const key = `${error.selectionPath.join('.')}:${error.argumentPath.join('.')}`
    const prevError = invalidArgsError.get(key)
    if (!prevError) {
      invalidArgsError.set(key, error)
    } else {
      invalidArgsError.set(key, {
        ...error,
        argument: {
          ...error.argument,
          typeNames: uniqueConcat(prevError.argument.typeNames, error.argument.typeNames),
        },
      })
    }
  }

  result.push(...invalidArgsError.values())
  return result
}

function uniqueConcat<T>(head: T[], tail: T[]): T[] {
  return [...new Set(head.concat(tail))]
}

/**
 * Function that attempts to pick the best error from the list
 * by ranking them. In most cases, highest ranking error would be the one
 * which has the longest combined "selectionPath" + "argumentPath". Justification
 * for that is that type that made it deeper into validation tree before failing
 * is probably closer to the one user actually wanted to do.
 *
 * However, if two errors are at the same depth level, we introduce additional ranking based
 * on error type. See `getErrorTypeScore` function for details
 * @param errors
 * @returns
 */
function getBestScoringError(errors: NonUnionError[]) {
  return maxWithComparator(errors, (errorA, errorB) => {
    const aPathLength = getCombinedPathLength(errorA)
    const bPathLength = getCombinedPathLength(errorB)
    if (aPathLength !== bPathLength) {
      return aPathLength - bPathLength
    }
    return getErrorTypeScore(errorA) - getErrorTypeScore(errorB)
  })
}

function getCombinedPathLength(error: EngineValidationError) {
  let score = 0
  if (Array.isArray(error.selectionPath)) {
    score += error.selectionPath.length
  }

  if (Array.isArray(error.argumentPath)) {
    score += error.argumentPath.length
  }
  return score
}

/**
 * Function is invoked to determine most relevant error based on its type.
 * Specific numbers returned from this function do not really matter, it's only
 * important how they compare relatively to each other.
 *
 * Current logic is:
 * - InvalidArgumentValue/ValueTooLarge is treated as the best possible error to display
 * since when it is present we know that the field causing the error is defined on the schema
 * and provided value has correct type, it's just that value violates some other constraint.
 * - Next candidate is `InvalidArgumentType` error. We know the field user specified can exists in
 * this spot, it's just that value provided has incorrect type.
 * - All other engine-side errors follow. At that point it's difficult to say which of them is more relevant,
 * so we treat them equally. We might adjust this logic in the future.
 * - RequiredArgumentMissing is penalized because this error is often used to disambiguate
 * union types and what is required in one arm of the union might be fine to leave out in another
 * @param error
 * @returns
 */
function getErrorTypeScore(error: EngineValidationError): number {
  switch (error.kind) {
    case 'InvalidArgumentValue':
    case 'ValueTooLarge':
      return 20
    case 'InvalidArgumentType':
      return 10
    case 'RequiredArgumentMissing':
      return -10
    default:
      return 0
  }
}
