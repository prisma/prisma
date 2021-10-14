/// <reference lib="webworker" />

import { Engine } from '../common/Engine'
import type {
  EngineConfig,
  EngineEventType,
  GetConfigResult,
} from '../common/Engine'
import { request } from './utils/request'
import EventEmitter from 'events'
import { createSchemaHash } from './utils/createSchemaHash'
import { decodeInlineSchema } from './utils/decodeInlineSchema'
import { backOff } from './utils/backOff'
import { getClientVersion } from './utils/getClientVersion'

const id = Math.ceil(Math.random() * 1000)

const MAX_RETRIES = 5

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

    return `https://${this.host}/${this.clientVersion}/${this.schemaHash}/${s}?id=${id}`
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

  private async uploadSchema() {
    await this.initPromise

    const res = await request(await this.url('schema'), {
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
        message: `Calling ${await this.url('graphql')} (n=${attempt})`,
      })

      const res = await request(await this.url('graphql'), {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body: JSON.stringify(body),
      })

      // 404 on the GraphQL, so we re-upload schema & retry
      if (res.status === 404) {
        await this.uploadSchema()

        throw new Error('Schema (re)uploaded')
      }

      if (!res.ok) {
        throw new Error('GraphQL request failed')
      }

      return res.json()
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

const datasourceRegexp =
  /datasource.*?url(?:\s|\t)*=(?:\s|\t)*(?:(?:"(?<url>.*?)")|(?:env\("(?<env>\w+)"\)))/gs

function extractHostAndApiKey(
  schemaText: string,
  env: { [k: string]: string | undefined },
) {
  const groups = datasourceRegexp.exec(schemaText)?.groups

  if (groups === undefined) {
    throw new Error('Could not extract URL of the datasource')
  }

  let url: URL
  try {
    url = new URL(groups?.url ?? env[groups?.env ?? ''])
  } catch {
    throw new Error('Could not parse URL of the datasource')
  }

  const { protocol, host, searchParams } = url

  if (protocol !== 'prisma:') {
    throw new Error('Datasource URL should use prisma:// protocol')
  }

  const apiKey = searchParams.get('api_key')
  if (apiKey === null || apiKey.length < 1) {
    throw new Error('No valid API key found in the datasource URL')
  }

  return [host, apiKey]
}
