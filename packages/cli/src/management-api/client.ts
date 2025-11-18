import { Debug } from '@prisma/debug'
import createClient from 'openapi-fetch'

import type { paths } from './openapi'

const debug = Debug('prisma:cli:management-api')

class FetchError extends Error {
  constructor() {
    super('Connection to API failed.')
  }
}

/**
 * Creates a fetch function that includes the given `initialToken` in the auth header.
 * This fetch function automatically detects expired tokens and refreshes them using the given `tokenRefreshHandler`.
 * It buffers all requests until the token is refreshed.
 *
 * @param initialToken - The initial token to use.
 * @param tokenRefreshHandler - The function to call to refresh the token.
 * @returns A fetch function that refreshes the token when it expires.
 */
function createTokenRefreshingFetch(initialToken: string, tokenRefreshHandler: () => Promise<{ token: string }>) {
  let currentToken = initialToken
  let refreshPromise: Promise<{ token: string }> | null = null
  let subscribers: ((token: string) => void)[] = []

  const isRefreshing = () => refreshPromise !== null

  const refreshAccessToken = async (): Promise<string> => {
    if (isRefreshing()) {
      debug('token refresh already in progress, waiting for it to complete...')
      return new Promise((resolve) => subscribers.push(resolve))
    }

    refreshPromise = tokenRefreshHandler().finally(() => {
      refreshPromise = null
    })

    const { token } = await refreshPromise

    debug('refreshed token!')

    currentToken = token
    subscribers.forEach((cb) => cb(token))
    subscribers = []

    return token
  }

  return async function tokenRefreshingFetch(request: globalThis.Request): Promise<Response> {
    const requestCloneForRetry = request.clone()
    request.headers.set('Authorization', `Bearer ${currentToken}`)

    let response = await fetch(request)

    if (response.status === 401) {
      debug('detected expired token, refreshing...')
      await refreshAccessToken()
      requestCloneForRetry.headers.set('Authorization', `Bearer ${currentToken}`)
      response = await fetch(requestCloneForRetry)
    }

    return response
  }
}

export function createManagementApiClient(token: string, tokenRefreshHandler: () => Promise<{ token: string }>) {
  const client = createClient<paths>({
    baseUrl: 'https://api.prisma.io',
    fetch: createTokenRefreshingFetch(token, tokenRefreshHandler),
  })
  client.use({
    onRequest({ request }) {
      debug('onRequest', {
        method: request.method,
        url: request.url,
        body: request.body,
      })
      return request
    },
    onResponse({ response }) {
      debug('onResponse', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
      })
      return response
    },
    onError({ error }) {
      debug('Fetch error', error)
      return new FetchError()
    },
  })
  return client
}
