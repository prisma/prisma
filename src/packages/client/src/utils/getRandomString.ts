import crypto from 'crypto'

export function getRandomString(n = 20) {
  return crypto.randomBytes(n).toString('hex')
}
