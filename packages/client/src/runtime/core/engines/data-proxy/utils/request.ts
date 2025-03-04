import type { CustomDataProxyFetch } from '../../common/Engine'
import { RequestError } from '../errors/NetworkError'

/**
 * `fetch` wrapper that applies the `customDataProxyFetch` override and handles
 * errors to attach error code.
 */
export async function request(
  url: string,
  options: RequestInit & { clientVersion: string },
  customFetch: CustomDataProxyFetch = (fetch) => fetch,
): Promise<Response> {
  const { clientVersion, ...fetchOptions } = options
  const decoratedFetch = customFetch(fetch) as typeof fetch

  try {
    return await decoratedFetch(url, fetchOptions)
  } catch (error) {
    const message = (error as Error).message ?? 'Unknown error'
    throw new RequestError(message, { clientVersion, cause: error })
  }
}
