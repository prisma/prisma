/// <reference lib="webworker" />

import { Engine } from '../common/Engine'
import type {
  EngineConfig,
  EngineEventType,
  GetConfigResult,
} from '../common/Engine'
import EventEmitter from 'events'
import prismafile from 'prismafile'

const BACKOFF_INTERVAL = 250
const MAX_RETRIES = 5

function backOff(n: number): Promise<number> {
  const baseDelay = Math.pow(2, n) * BACKOFF_INTERVAL
  const jitter = Math.ceil(Math.random() * baseDelay) - Math.ceil(baseDelay / 2)
  const total = baseDelay + jitter

  return new Promise((done) => setTimeout(() => done(total), total))
}

/**
 * Detects the runtime environment
 * @returns
 */
export function getRuntimeName() {
  if (typeof self === undefined) {
    return 'node'
  }

  return 'browser'
}

/**
 * Determine the client version to be sent to the DataProxy
 * @param config
 * @returns
 */
function getClientVersion(config: EngineConfig) {
  const [version, suffix] = config.clientVersion?.split('-') ?? []

  // we expect the version to match the pattern major.minor.patch
  if (!suffix && /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(version)) {
    return version
  }

  return '3.1.1' // and we default it to this one if does not
}

/**
 * Create a SHA256 hash from an `inlineSchema` with the methods available on the
 * runtime. We don't polyfill this so we can keep bundles as small as possible.
 * @param inlineSchema
 * @returns
 */
async function createSchemaHash(inlineSchema: string) {
  const schemaBuffer = Buffer.from(inlineSchema)
  const runtimeName = getRuntimeName()

  if (runtimeName === 'node') {
    const crypto = (0, eval)(`require('crypto')`) // don't bundle
    const hash = crypto.createHash('sha256').update(schemaBuffer)

    return hash.digest('hex')
  } else if (runtimeName === 'browser') {
    const hash = await crypto.subtle.digest('SHA-256', schemaBuffer)

    return Buffer.from(hash).toString('hex')
  }

  return ''
}

/**
 * Decode the contents from an `inlineSchema`
 * @param inlineSchema
 * @returns
 */
function decodeInlineSchema(inlineSchema: string) {
  return Buffer.from(inlineSchema, 'base64').toString()
}

export class DataProxyEngine extends Engine {
  private initPromise: Promise<void>
  private inlineSchema: string
  private config: EngineConfig
  private logEmitter: EventEmitter
  private env: { [k: string]: string }

  private clientVersion!: string
  private headers!: { Authorization: string }
  private host!: string
  private schemaHash!: string
  private schemaText!: string

  constructor(config: EngineConfig) {
    super()

    this.config = config
    this.env = this.config.env ?? {}
    this.inlineSchema = config.inlineSchema ?? ''

    this.logEmitter = new EventEmitter()
    this.logEmitter.on('error', () => {})

    this.initPromise = this.init()
  }

  /**
   * !\ Asynchronous constructor that inits the properties marked with `!`.
   * So any function that uses such a property needs to await `initPromise`.
   */
  private async init() {
    // we use inline schema to get a hash from it as well as its original content
    this.schemaHash = await createSchemaHash(this.inlineSchema)
    this.schemaText = decodeInlineSchema(this.inlineSchema)

    // we set the network stuff up for the engine to make http calls to the proxy
    const [host, apiKey] = extractHostAndApiKey(this.schemaText, this.env)
    this.clientVersion = getClientVersion(this.config)
    this.headers = { Authorization: `Bearer ${apiKey}` }
    this.host = host

    await this.initUploadSchema()
  }

  version() {
    // QE is remote, we don't need to know the exact commit SHA
    return 'unknown'
  }

  async start() {}
  async stop() {}

  on(event: EngineEventType, listener: (args?: any) => any): void {
    if (event === 'beforeExit') {
      // TODO: hook into the process
      throw new Error('beforeExit event is not supported yet')
    } else {
      this.logEmitter.on(event, listener)
    }
  }

  private async url(s: string) {
    await this.initPromise

    return `https://${this.host}/${this.clientVersion}/${this.schemaHash}/${s}`
  }

  // TODO: looks like activeProvider is the only thing
  // used externally; verify that
  async getConfig() {
    await this.initPromise

    return {
      datasources: [
        {
          activeProvider: this.config.activeProvider,
        },
      ],
    } as GetConfigResult
  }

  private async initUploadSchema() {
    const res = await fetch(await this.url('schema'), {
      method: 'PUT',
      headers: this.headers,
      body: this.config.inlineSchema,
    })

    if (res) {
      this.logEmitter.emit('info', {
        message: `Schema (re)uploaded (hash: ${this.schemaHash})`,
      })
    } else {
      this.logEmitter.emit('warn', { message: 'Could not upload the schema' })
      throw new Error('Could not upload the schema')
    }
  }

  request<T>(query: string, headers: Record<string, string>, attempt = 0) {
    this.logEmitter.emit('query', { query })

    return this.requestInternal<T>({ query, variables: {} }, headers, attempt)
  }

  async requestBatch<T>(
    queries: string[],
    headers: Record<string, string>,
    isTransaction = false,
    attempt = 0,
  ) {
    this.logEmitter.emit('query', {
      query: `Batch${isTransaction ? ' in transaction' : ''} (${
        queries.length
      }):\n${queries.join('\n')}`,
    })

    const body = {
      batch: queries.map((query) => ({ query, variables: {} })),
      transaction: isTransaction,
    }

    const { batchResult } = await this.requestInternal<T>(
      body,
      headers,
      attempt,
    )

    return batchResult
  }

  private async requestInternal<T>(
    body: Record<string, any>,
    headers: Record<string, string>,
    attempt: number,
  ) {
    await this.initPromise

    try {
      this.logEmitter.emit('info', {
        message: `Calling ${this.url('graphql')} (n=${attempt})`,
      })

      const res = await fetch(await this.url('graphql'), {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body: JSON.stringify(body),
      })

      // 404 on the GraphQL endpoint may mean that the schema
      // was not uploaded yet.
      if (res.status === 404) {
        await this.initUploadSchema()

        // return await this.requestInternal(body, headers, attempt)
        throw new Error(JSON.stringify(res))
      }

      if (!res.ok) {
        throw new Error('GraphQL request failed')
      }

      return JSON.parse(await res.text())
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        this.logEmitter.emit('error', {
          message: `Failed to query: ${err.message}`,
        })
        throw err
      } else {
        const delay = await backOff(attempt)
        this.logEmitter.emit('warn', { message: `Retrying after ${delay}ms` })
        return this.requestInternal<T>(body, headers, attempt + 1)
      }
    }
  }

  // TODO: figure out how to support transactions
  transaction(): Promise<any> {
    throw new Error('Transactions are currently not supported in Data Proxy')
  }
}

// Regex + prismafile feels fragile...
// TODO: build a minimal single-purpose (URL extraction)
// and well-tested TS schema parser
function extractHostAndApiKey(
  schemaText: string,
  env: { [k: string]: string },
) {
  // Extract the datasource block so we feed prismafile with minimal input
  const strippedToDatasource = /datasource[ \t]+[^\s]+[ \t]+\{[^}]+}/.exec(
    schemaText,
  )
  if (!strippedToDatasource) {
    throw new Error('Could not find a valid datasource block in the schema')
  }

  const datasourceText = strippedToDatasource[0]
  if (typeof datasourceText !== 'string' || datasourceText.length < 1) {
    throw new Error('Could not find a valid datasource block in the schema')
  }

  // Use prismafile to determine the URL
  let url = ''
  try {
    const schemaAst = prismafile.parse(datasourceText)
    const [datasource] = schemaAst.blocks.filter(
      (b) => b.type === 'datasource',
    ) as any[]

    // Datasource type is not exported from prismafile, so from now on
    // we're in any-land. Hence the dirtiness and the big try/catch around.

    const urlAssignment = datasource.assignments.find(
      (a: any) => a.key?.type === 'identifier' && a.key?.name === 'url',
    )

    if (!urlAssignment || !urlAssignment.value) {
      throw new Error('No assignment found')
    }

    const { type, value, name, arguments: args } = urlAssignment.value

    if (type === 'string_value' && typeof value === 'string') {
      url = value // Datasource URL directly in the schema
    } else if (
      type === 'function_value' &&
      name?.type === 'identifier' &&
      name.name === 'env' &&
      Array.isArray(args)
    ) {
      const arg = args[0]

      if (arg?.type === 'string_value' && typeof arg.value === 'string') {
        const envVarName = arg.value.trim()

        if (envVarName.length > 0) {
          // Datasource URL in environment
          url = env[envVarName] ?? ''
        }
      }
    }

    url = url.trim()
    if (url.length < 1) {
      throw new Error('No URL in schema nor environment')
    }
  } catch (err) {
    throw new Error('Could not extract URL of the datasource')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (err) {
    throw new Error('Could not parse URL of the datasource')
  }

  const { protocol, host, searchParams } = parsed

  if (protocol !== 'prisma:') {
    throw new Error('Datasource URL should use prisma:// protocol')
  }

  if (host.length < 1) {
    throw new Error('No valid host found in the datasource URL')
  }

  const apiKey = searchParams.get('api_key')
  if (!apiKey || apiKey.length < 1) {
    throw new Error('No valid API key found in the datasource URL')
  }

  return [host, apiKey]
}
