import { QueryEngineRequestHeaders } from '../types/QueryEngine'

/**
 * Takes runtime data headers and turns it into QE HTTP headers
 * @param headers to transform
 * @returns
 */
export function runtimeHeadersToHttpHeaders(headers: QueryEngineRequestHeaders): Record<string, string | undefined> {
  return Object.keys(headers).reduce((acc, runtimeHeaderKey) => {
    let httpHeaderKey = runtimeHeaderKey

    if (runtimeHeaderKey === 'transactionId') {
      httpHeaderKey = 'X-transaction-id'
    }

    // if header key isn't changed, a copy happens
    acc[httpHeaderKey] = headers[runtimeHeaderKey]

    return acc
  }, {} as Record<string, string | undefined>)
}
