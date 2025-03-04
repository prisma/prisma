import type { Value } from './scope'

/**
 * A `QueryPlanDbQuery` in which all placeholders have been substituted with
 * their values from the environment.
 */
export type QueryWithSubstitutedPlaceholders = {
  query: string
  params: Value[]
}

const BEGIN_REPEAT = '/* prisma-comma-repeatable-start */'
const END_REPEAT = '/* prisma-comma-repeatable-end */'

enum State {
  Normal = 0,
  Quoted = 1,
  Repeating = 2,
}

// Renders a query template by expanding the repetition macros, renumbering
// the SQL parameters accordingly, and flattening the corresponding array
// parameter values into scalars.
//
// For example, given the following query template:
// ```
// SELECT * WHERE "userId" IN /* prisma-comma-repeatable-start */$1/* prisma-comma-repeatable-end */ OFFSET $2
// ```
// and the following parameters:
// ```
// [[1, 2, 3], 0]
// ```
// it will produce the following query:
// ```
// SELECT * WHERE "userId" IN ($1, $2, $3) OFFSET $4
// ```
// and the following parameters:
// ```
// [1, 2, 3, 0]
// ```
//
// This is a temporary solution for the proof-of-concept. We will change quaint to write structured templates instead.
export function renderQueryTemplate({
  query,
  params,
}: QueryWithSubstitutedPlaceholders): QueryWithSubstitutedPlaceholders {
  if (!query.includes(BEGIN_REPEAT)) {
    return { query, params }
  }

  const flattenedParams: Value[] = []
  let lastParamId = 1
  let result = ''
  let templatePos = 0

  let state = State.Normal
  let stateBeforeQuote = State.Normal

  while (templatePos < query.length) {
    const nextChar = query[templatePos]

    if (state === State.Quoted && nextChar !== '"') {
      result += nextChar
      templatePos++
      continue
    }

    if (nextChar === '"') {
      if (state === State.Quoted) {
        state = stateBeforeQuote
      } else {
        stateBeforeQuote = state
        state = State.Quoted
      }

      result += nextChar
      templatePos++
      continue
    }

    if (query.slice(templatePos, templatePos + BEGIN_REPEAT.length) === BEGIN_REPEAT) {
      if (state === State.Repeating) {
        throw new Error('Nested repetition is not allowed')
      }

      state = State.Repeating
      templatePos += BEGIN_REPEAT.length
      result += '('

      continue
    }

    if (query.slice(templatePos, templatePos + END_REPEAT.length) === END_REPEAT) {
      if (state === State.Normal) {
        throw new Error('Unmatched repetition end')
      }

      state = State.Normal
      templatePos += END_REPEAT.length
      result += ')'

      continue
    }

    if (nextChar === '$') {
      const paramMatch = query.slice(templatePos + 1).match(/^\d+/)

      if (!paramMatch) {
        result += '$'
        templatePos++
        continue
      }

      templatePos += paramMatch[0].length + 1

      const originalParamIdx = Number.parseInt(paramMatch[0])
      const paramValue = params[originalParamIdx - 1]

      switch (state) {
        case State.Normal: {
          flattenedParams.push(paramValue)
          result += `$${lastParamId++}`
          break
        }

        case State.Repeating: {
          const paramArray = Array.isArray(paramValue) ? paramValue : [paramValue]

          if (paramArray.length === 0) {
            result += 'NULL'
            break
          }

          paramArray.forEach((value, idx) => {
            flattenedParams.push(value)
            result += `$${lastParamId++}`

            if (idx !== paramArray.length - 1) {
              result += ', '
            }
          })

          break
        }

        default: {
          throw new Error(`Unexpected state: ${state}`)
        }
      }

      continue
    }

    result += nextChar
    templatePos++
  }

  return {
    query: result,
    params: flattenedParams,
  }
}
