import { Command, isError } from '@prisma/internals'
import listen from 'async-listen'
import http from 'http'
import { underline } from 'kleur/colors'
import open from 'open'

import { getInstalledPrismaClientVersion } from '../utils/getClientVersion'
import { platformConsoleUrl, writeAuthConfig } from '../utils/platform'

interface AuthResult {
  token: string
  user: {
    id: string
    displayName: string
    handle: string
    email: string
  }
}

export class Login implements Command {
  public static new(): Login {
    return new Login()
  }

  public async parse() {
    console.log('Authenticating to Prisma Platform CLI via browser')

    const server = http.createServer()
    // When passing 0 as a port to listen, the OS will assign a random available port
    const authRedirectUrl = await listen(server, 0, '127.0.0.1')
    const authSigninUrl = await generateAuthSigninUrl({ connection: `github`, redirectTo: authRedirectUrl.href })

    console.log('Visit the following URL in your browser to authenticate:')
    console.log(underline(authSigninUrl.href))

    try {
      const [authResult] = await Promise.all([
        new Promise<AuthResult>((resolve, reject) => {
          server.once('request', (req, res) => {
            server.close()
            res.setHeader('connection', 'close')
            const searchParams = new URL(req.url || '/', 'http://localhost').searchParams
            const token = searchParams.get('token') ?? ''
            const error = searchParams.get('error')
            const location = new URL(`${platformConsoleUrl}/auth/cli`)

            if (error) {
              location.pathname += '/error'
              location.searchParams.set('error', error)
              reject(new Error(error))
            } else {
              // TODO: Consider getting the user via Console API instead of passing it via query params
              const user = parseUser(searchParams.get('user') ?? '')
              if (user) {
                location.pathname += '/success'
                location.searchParams.set('email', user.email)
                resolve({ token, user })
              } else {
                location.pathname += '/error'
                location.searchParams.set('error', 'Invalid user')
                reject(new Error('Invalid user'))
              }
            }

            res.statusCode = 302
            res.setHeader('location', location.href)
            res.end()
          })
          server.once('error', reject)
        }),
        open(authSigninUrl.href),
      ])

      await writeAuthConfig({ token: authResult.token })
      console.log('Authenticated successfully as:')
      console.log(JSON.stringify(authResult.user, null, 4))
      return ''
    } catch (error) {
      throw new Error(`Authentication failed: ${isError(error) ? error.message : ''}`)
    }
  }
}

const generateAuthSigninUrl = async (params: { connection: string; redirectTo: string }) => {
  const prismaClientVersion = await getInstalledPrismaClientVersion().catch(() => null)
  const state = { client: `prisma@${prismaClientVersion}`, ...params }
  const stateEncoded = Buffer.from(JSON.stringify(state), `utf-8`).toString(`base64`)
  const queryParams = new URLSearchParams({ state: stateEncoded })
  return new URL(`${platformConsoleUrl}/auth/cli?${queryParams.toString()}`)
}

const isConsoleUser = (maybeUser: unknown): maybeUser is AuthResult['user'] => {
  if (typeof maybeUser !== 'object' || maybeUser === null) return false
  const user = maybeUser as AuthResult['user']
  return (
    typeof user.id === 'string' &&
    typeof user.displayName === 'string' &&
    typeof user.handle === 'string' &&
    typeof user.email === 'string'
  )
}

const parseUser = (stringifiedUser: string) => {
  try {
    const maybeUser = JSON.parse(Buffer.from(stringifiedUser, `base64`).toString(`utf-8`))
    return isConsoleUser(maybeUser) ? maybeUser : null
  } catch (error) {
    return null
  }
}
