import {
  Engine,
  EngineConfig,
  EngineEventType,
  GetConfigResult,
} from '@prisma/engine-core/src/common/Engine'
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
    // TODO: how to get the current version the right way?
    const clientVersion = '2.29.1'

    this.url = (s) => `https://${host}/${clientVersion}/${this.schemaHash}/${s}`
    this.headers = { Authorization: `Bearer ${apiKey}` }

    this.logEmitter.on('error', () => {
      // Prevent unhandled error events
    })

    this.logEmitter.emit('info', `Ready for ${host}`)
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

    if (!res.ok) {
      this.logEmitter.emit('warn', 'Could not upload the schema')
      throw new Error('Could not upload the schema')
    }
  }

  async request<T>(q: string, _hs?: any, n = 0) {
    try {
      this.logEmitter.emit('query', q)

      const res = await fetch(this.url('graphql'), {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          operationName: null,
          variables: {},
          query: q,
        }),
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
      if (n >= MAX_RETRIES) {
        this.logEmitter.emit('error', `Failed to query: ${err.message}`)
        throw err
      } else {
        const delay = await backOff(n)
        this.logEmitter.emit('warn', `Retrying after ${delay}`)
        return this.request<T>(q, {}, n + 1)
      }
    }
  }

  requestBatch<T>(qs: string[], _hs: any, transact = false) {
    // TODO: transactions not supported (see below)
    // TODO: introduce batch endpoint in Data Proxy;
    // current implementation will result in `qs.length` HTTP calls
    return transact
      ? this.transaction()
      : Promise.all(qs.map((q) => this.request<T>(q)))
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
