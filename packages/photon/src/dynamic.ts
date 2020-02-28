import { getDMMF } from './generation/getDMMF'
import { DMMFClass } from './runtime/dmmf'
import { DMMF } from './runtime/dmmf-types'
import path from 'path'
import {
  lowerCase,
  Dataloader,
  printStack,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
  stripAnsi,
  unpack,
  makeDocument,
} from './runtime'
import { getOperation } from './generation/utils'
import { NodeEngine, EngineConfig } from '@prisma/engine-core/dist/NodeEngine'
import { Document } from './runtime/query'

const schema = `
datasource db {
  provider = "sqlite"
  url      = "file:dev.db"
  default  = true
}

generator client {
  provider = "prisma-client-js"
}

/// User model comment
model User {
  id    String  @default(uuid()) @id
  email String  @unique
  /// name comment
  name  String?
  posts Post[]
}

model Post {
  id        String   @default(cuid()) @id
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  published Boolean
  title     String
  content   String?
  author    User?
}

enum Role {
  USER
  ADMIN
}`

async function main() {
  const rawDmmf = await getDMMF({
    datamodel: schema,
  })
  // const dmmf = new DMMFClass(rawDmmf)
  const client: any = new NewPrismaClient(rawDmmf)
  const users = await client.user.findMany()
  console.log(users.length)
}

class NewPrismaClient {
  dmmf: DMMFClass
  engine: NodeEngine
  fetcher: PrismaClientFetcher
  connectionPromise?: Promise<any>
  disconnectionPromise?: Promise<any>
  engineConfig: EngineConfig
  constructor(doc: DMMF.Document) {
    this.dmmf = new DMMFClass(doc)
    this.engineConfig = {
      datamodelPath: path.join(
        __dirname,
        '../fixtures/blog/prisma/schema.prisma',
      ),
      cwd: path.join(__dirname, '../fixtures/blog/prisma/'),
    }
    this.engine = new NodeEngine(this.engineConfig)
    this.fetcher = new PrismaClientFetcher(this, false)
    this.bootstrapClient()
  }
  async connect() {
    if (this.disconnectionPromise) {
      await this.disconnectionPromise
    }
    if (this.connectionPromise) {
      return this.connectionPromise
    }
    this.connectionPromise = this.engine.start()
    return this.connectionPromise
  }
  /**
   * @private
   */
  async runDisconnect() {
    await this.engine.stop()
    delete this.connectionPromise
    this.engine = new NodeEngine(this.engineConfig)
    delete this.disconnectionPromise
  }
  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (!this.disconnectionPromise) {
      this.disconnectionPromise = this.runDisconnect()
    }
    return this.disconnectionPromise
  }
  bootstrapClient() {
    const clients = this.dmmf.mappings.reduce((acc, mapping) => {
      const lowerCaseModel = lowerCase(mapping.model)

      const client = ({ operation, actionName, rootField, args }) => {
        const document = makeDocument({
          dmmf: this.dmmf,
          rootField,
          rootTypeName: operation,
          select: args,
        })
        console.log(String(document))
        let requestPromise: Promise<any>

        const clientImplementation = {
          then: (onfulfilled, onrejected) => {
            if (!requestPromise) {
              requestPromise = this.fetcher.request({
                document,
                clientMethod: actionName,
                typeName: mapping.model,
                dataPath: [],
                isList: true,
                rootField,
              })
            }

            return requestPromise.then(onfulfilled, onrejected)
          },
          catch: onrejected => {
            if (!requestPromise) {
              requestPromise = this.fetcher.request({
                document,
                clientMethod: actionName,
                typeName: mapping.model,
                dataPath: [],
                isList: true,
                rootField,
              })
            }

            return requestPromise.catch(onrejected)
          },
          finally: onfinally => {
            if (!requestPromise) {
              requestPromise = this.fetcher.request({
                document,
                clientMethod: actionName,
                typeName: mapping.model,
                dataPath: [],
                isList: true,
                rootField,
              })
            }

            return requestPromise.finally(onfinally)
          },
        }

        return clientImplementation
      }

      acc[lowerCaseModel] = client

      return acc
    }, {})

    const properties = this.dmmf.mappings.reduce((acc, mapping) => {
      const lowerCaseModel = lowerCase(mapping.model)

      const denyList = {
        model: true,
        plural: true,
        aggregate: true,
      }

      const delegate = Object.entries(mapping).reduce(
        (acc, [actionName, rootField]) => {
          if (!denyList[actionName]) {
            const operation = getOperation(actionName as any)
            acc[actionName] = args =>
              clients[lowerCaseModel]({
                operation,
                actionName,
                rootField,
                args,
              })
          }

          return acc
        },
        {},
      )

      acc[lowerCaseModel] = delegate

      return acc
    }, {})

    Object.assign(this, properties)
    // Object.defineProperties(this, properties)
  }
}

class PrismaClientFetcher {
  prisma: any
  debug: boolean
  hooks: any
  dataloader: Dataloader
  constructor(prisma, enableDebug = false, hooks?: any) {
    this.prisma = prisma
    this.debug = enableDebug
    this.hooks = hooks
    this.dataloader = new Dataloader(async requests => {
      // TODO: More elaborate logic to only batch certain queries together
      // We should e.g. make sure, that findOne queries are batched together
      await this.prisma.connect()
      const queries = requests.map(r => String(r.document))
      return this.prisma.engine.request(queries)
    })
  }
  async request({
    document,
    dataPath = [],
    rootField,
    typeName,
    isList,
    callsite,
    collectTimestamps,
    clientMethod,
  }: {
    document: Document
    dataPath: string[]
    rootField: string
    typeName: string
    isList: boolean
    clientMethod: string
    callsite?: string
    collectTimestamps?: any
  }) {
    if (this.hooks && this.hooks.beforeRequest) {
      const query = String(document)
      this.hooks.beforeRequest({
        query,
        path: dataPath,
        rootField,
        typeName,
        document,
      })
    }
    try {
      collectTimestamps && collectTimestamps.record('Pre-prismaClientConnect')
      collectTimestamps && collectTimestamps.record('Post-prismaClientConnect')
      collectTimestamps && collectTimestamps.record('Pre-engine_request')
      const result = await this.dataloader.request({ document })
      collectTimestamps && collectTimestamps.record('Post-engine_request')
      collectTimestamps && collectTimestamps.record('Pre-unpack')
      const unpackResult = this.unpack(
        document,
        result,
        dataPath,
        rootField,
        isList,
      )
      collectTimestamps && collectTimestamps.record('Post-unpack')
      return unpackResult
    } catch (e) {
      if (callsite) {
        const { stack } = printStack({
          callsite,
          originalMethod: clientMethod,
          onUs: e.isPanic,
        })
        const message = stack + e.message
        if (e.code) {
          throw new PrismaClientKnownRequestError(
            this.sanitizeMessage(message),
            e.code,
            e.meta,
          )
        }
        if (e instanceof PrismaClientUnknownRequestError) {
          throw new PrismaClientUnknownRequestError(
            this.sanitizeMessage(message),
          )
        } else if (e instanceof PrismaClientInitializationError) {
          throw new PrismaClientInitializationError(
            this.sanitizeMessage(message),
          )
        } else if (e instanceof PrismaClientRustPanicError) {
          throw new PrismaClientRustPanicError(this.sanitizeMessage(message))
        }
      } else {
        if (e.code) {
          throw new PrismaClientKnownRequestError(
            this.sanitizeMessage(e.message),
            e.code,
            e.meta,
          )
        }
        if (e.isPanic) {
          throw new PrismaClientRustPanicError(e.message)
        } else {
          if (e instanceof PrismaClientUnknownRequestError) {
            throw new PrismaClientUnknownRequestError(
              this.sanitizeMessage(e.message),
            )
          } else if (e instanceof PrismaClientInitializationError) {
            throw new PrismaClientInitializationError(
              this.sanitizeMessage(e.message),
            )
          } else if (e instanceof PrismaClientRustPanicError) {
            throw new PrismaClientRustPanicError(
              this.sanitizeMessage(e.message),
            )
          }
        }
      }
    }
  }
  sanitizeMessage(message) {
    if (this.prisma.errorFormat && this.prisma.errorFormat !== 'pretty') {
      return stripAnsi(message)
    }
    return message
  }
  unpack(document, data, path, rootField, isList) {
    if (data.data) {
      data = data.data
    }
    const getPath: any[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter(p => p !== 'select' && p !== 'include'))
    return unpack({ document, data, path: getPath })
  }
}

class CollectTimestamps {
  records: any[]
  start: any
  additionalResults: any
  constructor(startName) {
    this.records = []
    this.start = undefined
    this.additionalResults = {}
    this.start = { name: startName, value: process.hrtime() }
  }
  record(name) {
    this.records.push({ name, value: process.hrtime() })
  }
  elapsed(start, end) {
    const diff = [end[0] - start[0], end[1] - start[1]]
    const nanoseconds = diff[0] * 1e9 + diff[1]
    const milliseconds = nanoseconds / 1e6
    return milliseconds
  }
  addResults(results) {
    Object.assign(this.additionalResults, results)
  }
  getResults() {
    const results = this.records.reduce((acc, record) => {
      const name = record.name.split('-')[1]
      if (acc[name]) {
        acc[name] = this.elapsed(acc[name], record.value)
      } else {
        acc[name] = record.value
      }
      return acc
    }, {})
    Object.assign(results, {
      total: this.elapsed(
        this.start.value,
        this.records[this.records.length - 1].value,
      ),
      ...this.additionalResults,
    })
    return results
  }
}

main()
