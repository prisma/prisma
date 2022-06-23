import crypto from 'crypto'
import path from 'path'

import { setupQueryEngine, setupTestSuiteClient, setupTestSuiteDatabase, setupTestSuiteDbURI } from './utils'

export interface TestClientOptions {
  schema: string
  provider: 'postgresql'
  uri: string
}

export type Log = {
  timestamp: string
  query: string
  params: string
  duration: string
  target: string
}

export class TestClient {
  public prisma?: any
  private schema: string
  private provider: 'postgresql'
  private uuid: string
  private generatedDir: string
  private schemaPath: string

  constructor({ schema, provider, uri }: TestClientOptions) {
    this.uuid = crypto.randomBytes(20).toString('hex')
    this.schema = schema.replace('DATABASE_URI', setupTestSuiteDbURI(uri, this.uuid))
    this.provider = provider
    this.generatedDir = path.join(__dirname, './generated', this.uuid)
    this.schemaPath = path.join(this.generatedDir, '/schema.prisma')
  }

  async generate() {
    await setupQueryEngine()
    await setupTestSuiteClient({
      schema: this.schema,
      provider: this.provider,
      generatedDir: this.generatedDir,
      schemaPath: this.schemaPath,
    })
    await setupTestSuiteDatabase(this.schemaPath)

    // @ts-ignore
    const { PrismaClient } = require(path.join(
      __dirname,
      'generated/',
      this.uuid,
      '/',
      'node_modules/',
      '@prisma/',
      'client/',
    ))

    // @ts-ignore
    this.prisma = new PrismaClient({ log: ['query'] })

    // @ts-ignore
    await this.prisma.$connect()
  }

  async query(query: () => Promise<any>): Promise<{ logs: Log[]; response: any }> {
    let hasQueryFinished = false
    const logs: Log[] = []

    function listener(l: Log) {
      if (hasQueryFinished) {
        // TODO remove listener
      } else {
        logs.push(l)
      }
    }

    const oldConsole = console.log
    console.log = () => undefined

    // @ts-ignore
    this.prisma.$on('query', listener)

    const response = await query()
    hasQueryFinished = true

    console.log = oldConsole

    return {
      logs: logs.filter((l) => !['BEGIN', 'COMMIT'].includes(l.query as string)),
      response,
    }
  }
}
