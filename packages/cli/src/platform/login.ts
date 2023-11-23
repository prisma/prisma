import { Command, isError, logger } from '@prisma/internals'
import listen from 'async-listen'
import http from 'http'
import { red, underline } from 'kleur/colors'
import open from 'open'

import { writeAuthConfig } from '../utils/platform'

// const CONSOLE_URL = `https://console.prisma.io`
const CONSOLE_URL = `http://localhost:8788`

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
    const { port } = await listen(server, 0, '127.0.0.1')

    const authRedirectUri = `http://localhost:${port}`
    const authSigninUrl = generateAuthSigninUrl({ connection: `github`, redirectTo: authRedirectUri })

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

            // TODO: Fetch the user via auth show command
            const user = JSON.parse(
              Buffer.from(searchParams.get('user') ?? '', `base64`).toString(`utf-8`),
            ) as AuthResult['user'] // TODO: Remove this type assertion and use zod or other validation strategy

            resolve({ token, user })

            // Redirect the user's web browser back to Console's CLI Auth success page
            const location = new URL(`${CONSOLE_URL}/auth/cli`)

            location.pathname += '/success'
            location.searchParams.set('email', user.email)

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
      logger.error(red(`Authentication failed: ${isError(error) ? error.message : ''}`))
      throw error
    }
  }
}

const generateAuthSigninUrl = (params: { connection: string; redirectTo: string }) => {
  const state = Buffer.from(JSON.stringify(params), `utf-8`).toString(`base64`)
  const queryParams = new URLSearchParams({ state })
  return new URL(`${CONSOLE_URL}/auth/cli?${queryParams.toString()}`)
}
