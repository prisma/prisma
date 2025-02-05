import { Value } from './scope'

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
  const flattened: Value[] = []
  let lastParamId = 1
  let result = ''
  let templatePos = 0

  while (templatePos < query.length) {
    if (query.slice(templatePos, templatePos + BEGIN_REPEAT.length) === BEGIN_REPEAT) {
      templatePos += BEGIN_REPEAT.length
      result += '('

      const paramNum = parseInt(query.slice(templatePos).match(/^\$(\d+)/)?.[1] ?? '0')
      const arrParam = params[paramNum - 1] as Value[]

      const expanded = arrParam.map((_, idx) => '$' + (lastParamId + idx)).join(', ')
      result += expanded
      flattened.push(...arrParam)
      lastParamId += arrParam.length

      templatePos += query.slice(templatePos).indexOf(END_REPEAT) + END_REPEAT.length
      result += ')'
    } else if (query[templatePos] === '$') {
      const paramMatch = query.slice(templatePos + 1).match(/^\d+/)
      if (paramMatch) {
        const paramNum = parseInt(paramMatch[0])
        const paramValue = params[paramNum - 1]

        if (!Array.isArray(paramValue)) {
          result += '$' + lastParamId
          flattened.push(paramValue)
          lastParamId++
          templatePos += paramMatch[0].length + 1
        }
      } else {
        result += query[templatePos]
        templatePos++
      }
    } else {
      result += query[templatePos]
      templatePos++
    }
  }

  return {
    query: result,
    params: flattened,
  }
}
