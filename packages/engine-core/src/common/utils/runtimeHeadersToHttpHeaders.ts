import { QueryEngineRequestHeaders } from '../types/QueryEngine'

/**
 * Takes runtime data headers and turns it into QE HTTP headers
 * @param headers to transform
 * @returns
 */
export function runtimeHeadersToHttpHeaders(headers: QueryEngineRequestHeaders): Record<string, string | undefined> {
  if (headers.transactionId) {
    const { transactionId, ...httpHeaders } = headers
    httpHeaders['X-transaction-id'] = transactionId
    return httpHeaders
  }
  return headers
}
