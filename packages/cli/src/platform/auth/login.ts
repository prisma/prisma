import Debug from '@prisma/debug'
import { Command, getCommandWithExecutor, isError, link } from '@prisma/internals'
import listen from 'async-listen'
import * as checkpoint from 'checkpoint-client'
import http from 'http'
import { green } from 'kleur/colors'
import open from 'open'

import { name as PRISMA_CLI_NAME, version as PRISMA_CLI_VERSION } from '../../../package.json'
import { platformConsoleUrl, readAuthConfig, successMessage, writeAuthConfig } from '../../utils/platform'

interface AuthResult {
  token: string
  user: {
    id: string
    displayName: string
    handle: string
    email: string
  }
}

const debug = Debug('prisma:cli:platform:login')

export class Login implements Command {
  public static new(): Login {
    return new Login()
  }

  public async parse() {
    const authConfig = await readAuthConfig()
    if (isError(authConfig)) throw authConfig
    if (authConfig.token)
      return `Already authenticated. Run ${green(
        getCommandWithExecutor('prisma platform auth show --early-access'),
      )} to see the current user.`

    console.info('Authenticating to Prisma Platform CLI via browser')

    const server = http.createServer()
    // When passing 0 as a port to listen, the OS will assign a random available port
    const authRedirectUrl = await listen(server, 0, '127.0.0.1')
    const authSigninUrl = await generateAuthSigninUrl({ connection: `github`, redirectTo: authRedirectUrl.href })

    console.info('Visit the following URL in your browser to authenticate:')
    console.info(link(authSigninUrl.href))

    try {
      const [authResult] = await Promise.all([
        new Promise<AuthResult>((resolve, reject) => {
          server.once('request', (req, res) => {
            server.close()
            res.setHeader('connection', 'close')
            const searchParams = new URL(req.url || '/', 'http://localhost').searchParams
            const token = searchParams.get('token') ?? ''
            const error = searchParams.get('error')
            const location = new URL('/auth/cli', platformConsoleUrl)

            if (error) {
              location.pathname += '/error'
              location.searchParams.set('error', error)
              reject(new Error(error))
            } else {
              // TODO: Consider getting the user via Console API instead of passing it via query params
              const user = parseUser(searchParams.get('user') ?? '')
              if (user) {
                searchParams.delete('token')
                searchParams.delete('user')
                location.pathname += '/success'
                const nextSearchParams = new URLSearchParams({
                  ...Object.fromEntries(searchParams.entries()),
                  email: user.email,
                })
                location.search = nextSearchParams.toString()
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

      const result = await writeAuthConfig({ token: authResult.token })
      if (isError(result)) throw result

      return successMessage(`Authentication successful for ${authResult.user.email}`)
    } catch (error) {
      throw new Error(`Authentication failed: ${isError(error) ? error.message : ''}`)
    }
  }
}

const generateAuthSigninUrl = async (params: { connection: string; redirectTo: string }) => {
  const cliSignature = await checkpoint.getSignature().catch((e) => {
    debug(`await checkpoint.getSignature() failed silently with ${e}`)
    return null
  })

  const state = {
    client: `${PRISMA_CLI_NAME}@${PRISMA_CLI_VERSION}`,
    // will be `null` if it throws during retrieval
    // will be a UUIDv4 when successful
    signature: cliSignature,
    ...params,
  }
  const stateEncoded = Buffer.from(JSON.stringify(state), `utf-8`).toString(`base64`)
  const url = new URL('/auth/cli', platformConsoleUrl)
  url.searchParams.set('state', stateEncoded)
  return url
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
  } catch (e) {
    debug(`parseUser() failed silently with ${e}`)
    return null
  }
}
