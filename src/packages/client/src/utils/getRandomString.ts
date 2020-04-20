import crypto from 'crypto'

export function getRandomString(n = 20): string {
  return crypto.randomBytes(n).toString('hex')
}
