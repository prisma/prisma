import type { IncomingMessage } from 'http'
import type _https from 'https'

import { getJSRuntimeName } from './getJSRuntimeName'

// our implementation handles less than the real fetch
export type RequestOptions = {
  headers?: { [k: string]: string }
  body?: string
  method?: string
}

// our implementation handles less than the real fetch
export type RequestResponse = {
  json(): Promise<any>
  readonly url: string
  readonly ok: boolean
  readonly status: number
}

declare let fetch: typeof nodeFetch

/**
 * Isomorphic `fetch` that imitates `fetch` via `http` when on Node.js.
 * @param url
 * @param options
 * @returns
 */
export async function request(url: string, options: RequestOptions = {}): Promise<RequestResponse> {
  const jsRuntimeName = getJSRuntimeName()

  if (jsRuntimeName === 'browser') {
    return fetch(url, options)
  } else {
    return nodeFetch(url, options)
  }
}

/**
 * Build http headers from fetch-like headers
 * @param options
 * @returns
 */
function buildHeaders(options: RequestOptions): RequestOptions['headers'] {
  return {
    // this ensures headers will always be valid
    ...JSON.parse(JSON.stringify(options.headers)),
    'Content-Type': 'application/json',
  }
}

/**
 * Build http options from fetch-like options
 * @param options
 * @returns
 */
function buildOptions(options: RequestOptions): _https.RequestOptions {
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
    json: () => JSON.parse(Buffer.concat(incomingData).toString()),
    ok: response.statusCode! >= 200 && response.statusCode! < 300,
    status: response.statusCode!,
    url: response.url!,
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
function nodeFetch(url: string, options: RequestOptions = {}): Promise<RequestResponse> {
  const httpsOptions = buildOptions(options)
  const incomingData = [] as Buffer[]

  return new Promise((resolve, reject) => {
    const https: typeof _https = eval(`require('https')`)

    // we execute the https request and build a fetch response out of it
    const request = https.request(url, httpsOptions, (response) => {
      response.on('data', (chunk: Buffer) => incomingData.push(chunk))
      response.on('end', () => resolve(buildResponse(incomingData, response)))
      response.on('error', reject)
    })

    request.on('error', reject) // handle errors
    request.write(options.body ?? '') // http body data
    request.end() // flush & send
  })
}
