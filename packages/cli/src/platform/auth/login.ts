import { select } from '@inquirer/prompts'
import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import { arg, type Command, getCommandWithExecutor, isError, link } from '@prisma/internals'
import listen from 'async-listen'
import http from 'node:http'
import { green } from 'kleur/colors'
import open from 'open'

import { credentialsFile } from '../_lib/credentials'
import { successMessage } from '../_lib/messages'
import { consoleUrl } from '../_lib/pdp'
import { unknownToError } from '../_lib/prelude'
import { getUserAgent } from '../_lib/userAgent'

interface CallbackData {
  token: string
  user: {
    id: string
    displayName: string
    email: string
  }
}

const debug = Debug('prisma:cli:platform:login')

export class Login implements Command {
  public static new() {
    return new Login()
  }

  public async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      // internal optimize flag to track signup attribution
      '--optimize': Boolean,
    })
    if (isError(args)) return args

    if (args['--optimize']) {
      console.warn("The '--optimize' flag is deprecated. Use API keys instead.")
    }

    const credentials = await credentialsFile.load()
    if (isError(credentials)) throw credentials
    if (credentials)
      return `Already authenticated. Run ${green(getCommandWithExecutor('prisma platform auth show --early-access'))} to see the current user.` // prettier-ignore

    console.info('Authenticating to Prisma Platform CLI via browser.\n')

    const server = http.createServer()
    /**
     * When passing 0 as a port to listen, the OS will assign a random available port
     */
    const randomPort = 0
    const redirectUrl = await listen(server, randomPort, '127.0.0.1')
    const loginUrl = await createLoginUrl({ connection: 'github', redirectTo: redirectUrl.href })

    console.info('Visit the following URL in your browser to authenticate:')
    console.info(link(loginUrl.href))

    const callbackResult = await Promise.all([
      new Promise<CallbackData>((resolve, reject) => {
        server.once('request', (req, res) => {
          server.close()
          res.setHeader('connection', 'close')
          const searchParams = new URL(req.url || '/', 'http://localhost').searchParams
          const token = searchParams.get('token') ?? ''
          const error = searchParams.get('error')
          const location = getBaseAuthUrl()

          if (error) {
            location.pathname += '/error'
            location.searchParams.set('error', error)
            reject(new Error(error))
          } else {
            // TODO: Consider getting the user via Console API instead of passing it via query params
            const user = decodeUser(searchParams.get('user') ?? '')
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
      open(loginUrl.href),
    ])
      .then((results) => results[0])
      .catch(unknownToError)

    if (isError(callbackResult)) throw new Error(`Authentication failed: ${callbackResult.message}`) // prettier-ignore

    {
      const writeResult = await credentialsFile.save({ token: callbackResult.token })
      if (isError(writeResult)) throw new Error('Writing credentials to disk failed', { cause: writeResult })
    }

    return successMessage(`Authentication successful for ${callbackResult.user.email}`)
  }
}

const getBaseAuthUrl = () => new URL('/auth/cli', consoleUrl)

const createLoginUrl = async (params: { connection: string; redirectTo: string }) => {
  const userAgent = await getUserAgent()
  const state: State = {
    client: userAgent,
    ...params,
  }
  const stateEncoded = encodeState(state)
  const url = getBaseAuthUrl()
  url.searchParams.set('state', stateEncoded)

  return url
}

interface State {
  client: string
  connection: string
  redirectTo: string
}

const encodeState = (state: State) => Buffer.from(JSON.stringify(state), 'utf-8').toString('base64')

const decodeUser = (stringifiedUser: string) => {
  try {
    const maybeUser = JSON.parse(Buffer.from(stringifiedUser, 'base64').toString('utf-8'))
    if (typeof maybeUser !== 'object' || maybeUser === null) return false
    const isUser =
      typeof maybeUser.id === 'string' &&
      typeof maybeUser.displayName === 'string' &&
      typeof maybeUser.email === 'string'
    return isUser ? maybeUser : null
  } catch (e) {
    debug(`parseUser() failed silently with ${e}`)
    return null
  }
}

export const loginOrSignup = async () => {
  const providerAnswer = await select({
    message: 'Select an authentication method',
    default: 'google',
    choices: [
      { name: 'Google', value: 'google' },
      { name: 'GitHub', value: 'github' },
    ],
  })
  console.info('Authenticating to Prisma Platform via browser.\n')

  const server = http.createServer()
  /**
   * When passing 0 as a port to listen, the OS will assign a random available port
   */
  const randomPort = 0
  const redirectUrl = await listen(server, randomPort, '127.0.0.1')
  const loginUrl = await createLoginUrl({ connection: providerAnswer, redirectTo: redirectUrl.href })

  console.info('Visit the following URL in your browser to authenticate:')
  console.info(link(loginUrl.href))

  const callbackResult = await Promise.all([
    new Promise<CallbackData>((resolve, reject) => {
      server.once('request', (req, res) => {
        server.close()
        res.setHeader('connection', 'close')
        const searchParams = new URL(req.url || '/', 'http://localhost').searchParams
        const token = searchParams.get('token') ?? ''
        const error = searchParams.get('error')
        const location = getBaseAuthUrl()

        if (error) {
          location.pathname += '/error'
          location.searchParams.set('error', error)
          reject(new Error(error))
        } else {
          // TODO: Consider getting the user via Console API instead of passing it via query params
          const user = decodeUser(searchParams.get('user') ?? '')
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
    open(loginUrl.href),
  ])
    .then((results) => results[0])
    .catch(unknownToError)

  if (isError(callbackResult)) throw new Error(`Authentication failed: ${callbackResult.message}`) // prettier-ignore

  {
    const writeResult = await credentialsFile.save({ token: callbackResult.token })
    if (isError(writeResult)) throw new Error('Writing credentials to disk failed', { cause: writeResult })
  }

  return {
    message: successMessage(`Authentication successful for ${callbackResult.user.email}`),
    email: callbackResult.user.email,
    token: callbackResult.token,
  }
}
