import type { IncomingMessage } from 'http'
import type Https from 'https'

import { RequestError } from '../errors/NetworkError'

// our implementation handles less
export type RequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export type RequestResponse = {
  ok: boolean
  url: string
  statusText?: string
  status: number
  headers: NodeHeaders
  text: () => Promise<string>
  json: () => Promise<any>
}

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

  try {
    if (typeof fetch === 'function') {
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
    text: () => Promise.resolve(Buffer.concat(incomingData).toString()),
    // trying to emulate what real fetch would do:
    // 1. Ensure that parsing starts in next microtask
    // 2. Ensure that if parsing fails, we get a rejected promise, not sync exception
    json: () => Promise.resolve().then(() => JSON.parse(Buffer.concat(incomingData).toString())),
    ok: response.statusCode! >= 200 && response.statusCode! <= 299,
    status: response.statusCode!,
    url: response.url!,
    headers: new NodeHeaders(response.headers),
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
      const {
        statusCode,
        headers: { location },
      } = response

      if (statusCode! >= 301 && statusCode! <= 399 && location) {
        if (location.startsWith('http') === false) {
          resolve(nodeFetch(`${origin}${location}`, options))
        } else {
          resolve(nodeFetch(location, options))
        }
      }

      response.on('data', (chunk: Buffer) => incomingData.push(chunk))
      response.on('end', () => {
        return resolve(buildResponse(incomingData, response))
      })
      response.on('error', reject)
    })

    request.on('error', reject) // handle errors
    request.end(options.body ?? '') // flush & send
  })
}

// trick to obfuscate require from bundlers, useful for Vercel Edge
const include = typeof require !== 'undefined' ? require : () => {}

export class NodeHeaders {
  readonly headers = new Map<string, string>()

  constructor(init: Record<any, any> = {}) {
    for (const [key, value] of Object.entries(init)) {
      if (typeof value === 'string') {
        this.headers.set(key, value)
      } else if (Array.isArray(value)) {
        for (const val of value) {
          this.headers.set(key, val)
        }
      }
    }
  }

  append(name: string, value: string): void {
    this.headers.set(name, value)
  }

  delete(name: string): void {
    this.headers.delete(name)
  }

  get(name: string): string | null {
    return this.headers.get(name) ?? null
  }

  has(name: string): boolean {
    return this.headers.has(name)
  }

  set(name: string, value: string): void {
    this.headers.set(name, value)
  }

  forEach(callbackfn: (value: string, key: string, parent: this) => void, thisArg?: any): void {
    for (const [key, value] of this.headers) {
      callbackfn.call(thisArg, value, key, this)
    }
  }
}
