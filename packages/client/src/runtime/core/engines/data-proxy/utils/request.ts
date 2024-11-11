import { RequestError } from '../errors/NetworkError'

export type Fetch = typeof fetch

/**
 * Isomorphic `fetch` that imitates `fetch` via `https` when on Node.js.
 * @param url
 * @param options
 * @returns
 */
export async function request(
  url: string,
  options: RequestInit & { clientVersion: string },
  customFetch: (fetch: Fetch) => Fetch = (fetch) => fetch,
): Promise<Response> {
  const clientVersion = options.clientVersion

  try {
    return await customFetch(fetch)(url, options)
  } catch (error) {
    const message = (error as Error).message ?? 'Unknown error'
    throw new RequestError(message, { clientVersion, cause: error })
  }
}
