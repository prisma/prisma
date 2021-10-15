import {
  Engine,
  EngineConfig,
  EngineEventType,
  GetConfigResult,
} from '@prisma/engine-core/src/common/Engine'
import { clientVersion } from './utils/clientVersion'

import fs from 'fs'
import { createHash } from 'crypto'
import { URL } from 'url'
import EventEmitter from 'events'
import * as prismafile from 'prismafile'
import fetch from 'node-fetch'

const BACKOFF_INTERVAL = 250
const MAX_RETRIES = 5

function backOff(n: number): Promise<number> {
  const baseDelay = Math.pow(2, n) * BACKOFF_INTERVAL
  const jitter = Math.ceil(Math.random() * baseDelay) - Math.ceil(baseDelay / 2)
  const total = baseDelay + jitter

  return new Promise((done) => setTimeout(() => done(total), total))
}

function getClientVersion() {
  // Expect version to be major.minor.patch
  const [version, suffix] = clientVersion.split('-')
  const isMMP = !suffix && /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(version)

  // Default to a know version if not major.minor.patch
  return isMMP ? version : '3.2.0'
}

// TODO: move to @prisma/engine-core
export class DataProxyEngine extends Engine {
  private schemaText: string
  private schemaBase64: string
  private schemaHash: string

  private url: (s: string) => string
  private headers: { Authorization: string }

  private logEmitter = new EventEmitter()

  constructor(private config: EngineConfig) {
    super()

    this.schemaText = fs.readFileSync(config.datamodelPath, 'utf8')
    this.schemaBase64 = Buffer.from(this.schemaText).toString('base64')
    this.schemaHash = createHash('sha256')
      .update(this.schemaBase64)
      .digest('hex')

    const [host, apiKey] = extractHostAndApiKey(this.schemaText)
    const clientVersion = getClientVersion()

    this.url = (s) => `https://${host}/${clientVersion}/${this.schemaHash}/${s}`
    this.headers = { Authorization: `Bearer ${apiKey}` }

    this.logEmitter.on('error', () => {
      // Prevent unhandled error events
    })
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

  // TODO: looks like activeProvider is the only thing
  // used externally; verify that
  getConfig() {
    return Promise.resolve({
      datasources: [
        {
          activeProvider: this.config.activeProvider,
        },
      ],
    } as GetConfigResult)
  }

  private async uploadSchema() {
    const res = await fetch(this.url('schema'), {
      method: 'PUT',
      headers: this.headers,
      body: this.schemaBase64,
    })

    if (res.ok) {
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
    try {
      this.logEmitter.emit('info', {
        message: `Calling ${this.url('graphql')} (n=${attempt})`,
      })

      const res = await fetch(this.url('graphql'), {
        method: 'POST',
        headers: { ...headers, ...this.headers },
        body: JSON.stringify(body),
      })

      // 404 on the GraphQL endpoint may mean that the schema
      // was not uploaded yet.
      if (res.status === 404) {
        await this.uploadSchema()
        throw new Error('Schema (re)uploaded')
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
function extractHostAndApiKey(schemaText: string) {
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
          url = process.env[envVarName] ?? ''
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
