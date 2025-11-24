import { isError } from '@prisma/internals'

import { isObject, tryCatch } from './prelude'

export interface JWT {
  jti?: string
  sub?: string
  iat?: number
  exp?: number
}

export const decodeJwt = (jwt: string): JWT | Error => {
  if (typeof jwt !== 'string') throw new Error('JWTs must use Compact JWS serialization, JWT must be a string')

  const { 1: payload, length } = jwt.split('.')

  if (length === 5) throw new Error('Only JWTs using Compact JWS serialization can be decoded')
  if (length !== 3) throw new Error('Invalid JWT')
  if (!payload) throw new Error('JWTs must contain a payload')

  const decoded = tryCatch(
    () => atob(payload),
    () => new Error('Failed to base64 decode the payload.'),
  )
  if (isError(decoded)) return decoded

  const result = tryCatch(
    () => JSON.parse(decoded),
    () => new Error('Failed to parse the decoded payload as JSON.'),
  )
  if (isError(result)) return result

  if (!isObject(result)) throw new Error('Invalid JWT Claims Set.')

  return result
}

export const isJwtExpiredOrInvalid = (token: string): boolean => {
  const jwt = decodeJwt(token)
  if (isError(jwt)) return true
  if (!jwt.exp) return false
  // Note: The platform api uses millisecond timestamps but this is non standard! JWTs usually use seconds.
  // Hence this little workaround to detect automatically whether the timestamp is in milliseconds or seconds.
  if (jwt.exp / 1_000_000_000 > 200) {
    // Timestamp is in milliseconds
    return jwt.exp < Date.now()
  } else {
    // Timestamp is in seconds
    return jwt.exp < Date.now() / 1000
  }
}
