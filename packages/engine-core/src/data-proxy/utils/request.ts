import type { IncomingMessage } from 'http'
import type Https from 'https'
import type { RequestInit, Response } from 'node-fetch'
import type { O } from 'ts-toolbelt'

import { RequestError } from '../errors/NetworkError'
import { getJSRuntimeName } from './getJSRuntimeName'

// our implementation handles less
export type RequestOptions = O.Patch<{ headers?: { [k: string]: string }; body?: string }, RequestInit>

type Headers = Record<string, string | string[] | undefined>
export type RequestResponse = O.Required<
  O.Optional<O.Patch<{ text: () => string; headers: Headers }, Response>>,
  'text' | 'json' | 'url' | 'ok' | 'status'
>

export type Fetch = typeof nodeFetch

// fetch is global on edge runtime
declare let fetch: Fetch

/**
 * Isomorphic `fetch` that imitates `fetch` via `https` when on Node.js.
 * @param url
 * @param options
 * @returns
 */
export async function request(
  url: string,
  options: RequestOptions & { clientVersion: string },
  customFetch: (fetch: Fetch) => Fetch = (fetch) => fetch,
): Promise<RequestResponse> {
  const clientVersion = options.clientVersion
  const jsRuntimeName = getJSRuntimeName()

  try {
    if (jsRuntimeName === 'browser') {
      return await customFetch(fetch)(url, options)
    } else {
      return await customFetch(nodeFetch)(url, options)
    }
  } catch (e) {
    const message = e.message ?? 'Unknown error'
    throw new RequestError(message, { clientVersion })
  }
}

/**
 * Build http headers from fetch-like headers
 * @param options
 * @returns
 */
function buildHeaders(options: RequestOptions): RequestOptions['headers'] {
  return {
    ...options.headers,
    'Content-Type': 'application/json',
  }
}

/**
 * Build http options from fetch-like options
 * @param options
 * @returns
 */
function buildOptions(options: RequestOptions): Https.RequestOptions {
  return {
    method: options.method,
    headers: buildHeaders(options),
  }
}

/**
 * Build a fetch-like response from an http response
 * @param incomingData
 * @param response
 * @returns
 */
function buildResponse(incomingData: Buffer[], response: IncomingMessage): RequestResponse {
  return {
    text: () => Buffer.concat(incomingData).toString(),
    json: () => JSON.parse(Buffer.concat(incomingData).toString()),
    ok: response.statusCode! >= 200 && response.statusCode! <= 299,
    status: response.statusCode!,
    url: response.url!,
    headers: response.headers,
  }
}

/**
 * Imitates `fetch` via `https` to only suit our needs, it does nothing more.
 * This is because we cannot bundle `node-fetch` as it uses many other Node.js
 * utilities, while also bloating our bundles. This approach is much leaner.
 * @param url
 * @param options
 * @returns
 */
async function nodeFetch(url: string, options: RequestOptions = {}): Promise<RequestResponse> {
  const https: typeof Https = include('https')
  const httpsOptions = buildOptions(options)
  const incomingData = [] as Buffer[]
  const { origin } = new URL(url)

  return new Promise((resolve, reject) => {
    // we execute the https request and build a fetch response out of it
    const request = https.request(url, httpsOptions, (response) => {
      // eslint-disable-next-line prettier/prettier
      const { statusCode, headers: { location } } = response

      if (statusCode! >= 301 && statusCode! <= 399 && location) {
        if (location.startsWith('http') === false) {
          resolve(nodeFetch(`${origin}${location}`, options))
        } else {
          resolve(nodeFetch(location, options))
        }
      }

      response.on('data', (chunk: Buffer) => incomingData.push(chunk))
      response.on('end', () => resolve(buildResponse(incomingData, response)))
      response.on('error', reject)
    })

    request.on('error', reject) // handle errors
    request.end(options.body ?? '') // flush & send
  })
}

// trick to obfuscate require from bundlers, useful for Vercel Edge
const include = typeof require !== 'undefined' ? require : () => {}
