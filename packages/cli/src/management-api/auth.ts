import crypto from 'node:crypto'
import events from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'

import open from 'open'
import z from 'zod'

const CLIENT_ID = 'cmi4ttoor03pv2wco4526rnin'
const LOGIN_URL = 'https://auth.prisma.io/authorize'
const TOKEN_URL = 'https://auth.prisma.io/token'

export type AuthResult = {
  token: string
  refreshToken: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function login(): Promise<AuthResult> {
  const server = http.createServer()
  server.listen({ host: 'localhost', port: 0 })

  const addressInfo = await events.once(server, 'listening').then(() => server.address() as AddressInfo)
  const state = new LoginState('localhost', addressInfo.port)

  const authResult = new Promise<AuthResult>((resolve) => {
    server.on('request', async (req, res) => {
      const url = new URL(`http://${state.host}${req.url}`)
      const result = await state.handleCallback(url)

      if (result === null) {
        res.statusCode = 404
        res.end()
        return
      }

      res.setHeader('Content-Type', 'text/html')
      res.end(`
        <html>
          <head>
            <title>Login</title>
          </head>
          <body>
            <p>Success!</p>
            <p>You may now close this page.</p>
          </body>
        </html>
      `)

      setImmediate(() => {
        server.close()
      })

      resolve(result)
    })
  })

  await state.login()
  return await authResult
}

export class LoginState {
  private latestVerifier?: string
  private latestState?: string

  constructor(
    private hostname: string,
    private port: number,
  ) {}

  async login() {
    this.latestState = this.generateState()
    this.latestVerifier = this.generateVerifier()
    const challenge = this.generateChallenge(this.latestVerifier)

    const authUrl = new URL(LOGIN_URL)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', this.redirectUri)
    authUrl.searchParams.set('scope', 'workspace:admin offline_access')
    authUrl.searchParams.set('state', this.latestState)
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('utm_source', 'orm')
    authUrl.searchParams.set('utm_medium', 'cli')
    authUrl.searchParams.set('utm_campaign', 'oauth')

    await open(authUrl.href)
  }

  async handleCallback(url: URL): Promise<AuthResult | null> {
    if (url.pathname !== '/auth/callback') return null

    const params = url.searchParams

    const error = params.get('error')
    if (error) throw new AuthError(error)

    const code = params.get('code')
    const state = params.get('state')
    if (!code) throw new AuthError('No code found in callback')
    if (!this.latestVerifier) throw new AuthError('No verifier found')
    if (state !== this.latestState) throw new AuthError('Invalid state')

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: CLIENT_ID,
      code_verifier: this.latestVerifier,
    })

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    return parseTokenResponse(response)
  }

  get host(): string {
    return `${this.hostname}:${this.port}`
  }

  private get redirectUri(): string {
    return `http://${this.host}/auth/callback`
  }

  private base64urlEncode(buffer: Buffer): string {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  private generateState(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  private generateVerifier(): string {
    return this.base64urlEncode(crypto.randomBytes(32))
  }

  private generateChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest()
    return this.base64urlEncode(hash)
  }
}

export async function refreshToken(refreshToken: string): Promise<AuthResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  })
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const result = await parseTokenResponse(response)

  return result
}

async function parseTokenResponse(response: Response): Promise<AuthResult> {
  const data = await response.json()

  if (!response.ok) {
    throw new AuthError(`Failed to get token. Status code ${response.status}, response: ${JSON.stringify(data)}.`)
  }

  const parsed = z
    .object({
      access_token: z.string(),
      refresh_token: z.string(),
    })
    .parse(data)

  return { token: parsed.access_token, refreshToken: parsed.refresh_token }
}
