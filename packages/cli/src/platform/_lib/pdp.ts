import fetch, { Headers } from 'node-fetch'

import { getUserAgent } from './userAgent'

const platformAPIEndpoint = new URL('https://console.prisma.io/api')
export const consoleUrl = new URL('https://console.prisma.io')

/**
 *
 * @remarks
 *
 * TODO Feedback from Joel:
 *    It could be interesting to set a default timeout because it's not part of fetch spec, see:
 *    npmjs.com/package/node-fetch#request-cancellation-with-abortsignal
 */
export const requestOrThrow = async <
  $Data extends object = object,
  $Input extends null | object = null,
  $Variables extends null | object = null,
>(params: {
  token: string
  body: $Input extends null
    ? $Variables extends null
      ? {
          query: string
          variables?: undefined
        }
      : {
          query: string
          variables: $Variables
        }
    : {
        query: string
        variables: { input: $Input }
      }
}): Promise<$Data> => {
  const userAgent = await getUserAgent()
  const method = 'POST'
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${params.token}`,
    // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent
    'User-Agent': userAgent,
  })
  const body = JSON.stringify(params.body)
  const response = await fetch(platformAPIEndpoint.href, { method, headers, body })
  const text = await response.text()
  if (response.status >= 400) throw new Error(text)

  const json = JSON.parse(text) as { data: $Data; error: null | object }
  if (json.error) throw new Error(`Error from PDP Platform API: ${text}`)

  const error = Object.values(json.data).filter(
    (rootFieldValue): rootFieldValue is { __typename: string } =>
      typeof rootFieldValue === 'object' &&
      rootFieldValue !== null &&
      rootFieldValue.__typename?.startsWith('Error'),
  )[0]
  if (error) throw errorFromPlatformError({ message: '<message not selected from server>', ...error })

  return json.data
}

export const errorFromPlatformError = (error: PlatformError): Error => {
  return new Error(error.message)
}

export type PlatformError<$Types extends string = string> = {
  __typename: $Types
  message: string
}
