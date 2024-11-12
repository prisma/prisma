import { RequestError } from '../errors/NetworkError'

/**
 * This type is public and eventually exposed in the types of the runtime bundle
 * via `customDataProxyFetch` property, so we need make sure we don't rely on
 * the Node.js typings to avoid `/// <reference types="node" />` being injected.
 *
 * This does not accurately correspond to WHATWG fetch contract but it's what
 * `@prisma/extension-accelerate` expects.
 */
export type Fetch = (url: string, options?: FetchRequestOptions) => Promise<FetchResponse>

type FetchRequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

type FetchResponse = {
  body?: { cancel(): Promise<void> } | null
  ok: boolean
  url: string
  statusText?: string
  status: number
  headers: FetchHeaders
  text: () => Promise<string>
  json: () => Promise<unknown>
}

interface FetchHeaders extends Iterable<[string, string]> {
  append: (name: string, value: string) => void
  delete: (name: string) => void
  get: (name: string) => string | null
  has: (name: string) => boolean
  set: (name: string, value: string) => void
  getSetCookie: () => string[]
  forEach: (callbackfn: (value: string, key: string, iterable: Headers) => void, thisArg?: unknown) => void
  keys: () => IterableIterator<string>
  values: () => IterableIterator<string>
  entries: () => IterableIterator<[string, string]>
}

/**
 * `fetch` wrapper that applies the `customDataProxyFetch` override and handles
 * errors to attach error code.
 */
export async function request(
  url: string,
  options: RequestInit & { clientVersion: string },
  customFetch: (fetch: Fetch) => Fetch = (fetch) => fetch,
): Promise<Response> {
  const { clientVersion, ...fetchOptions } = options

  try {
    return (await customFetch(fetch)(url, fetchOptions as FetchRequestOptions)) as Response
  } catch (error) {
    const message = (error as Error).message ?? 'Unknown error'
    throw new RequestError(message, { clientVersion, cause: error })
  }
}
