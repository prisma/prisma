import { ErrorFormat } from '../../../getPrismaClient'
import { deepGet } from '../../../utils/deep-set'
import { EngineBatchQuery, JsonQuery, JsonQueryAction } from '../../engines'
import { RuntimeDataModel } from '../../runtimeDataModel'
import { CreateMessageOptions, ProtocolEncoder, ProtocolMessage } from '../common'
import { deserializeJsonResponse } from './deserialize'
import { serializeJsonQuery } from './serialize'

export class JsonProtocolEncoder implements ProtocolEncoder<JsonQuery> {
  constructor(private runtimeDataModel: RuntimeDataModel, private errorFormat: ErrorFormat) {}

  createMessage(createOptions: CreateMessageOptions): JsonProtocolMessage {
    const query = serializeJsonQuery({
      ...createOptions,
      runtimeDataModel: this.runtimeDataModel,
      errorFormat: this.errorFormat,
    })
    return new JsonProtocolMessage(query)
  }

  createBatch(messages: JsonProtocolMessage[]): EngineBatchQuery {
    return messages.map((message) => message.toEngineQuery())
  }
}

const isWrite: Record<JsonQueryAction, boolean> = {
  aggregate: false,
  aggregateRaw: false,
  createMany: true,
  createOne: true,
  deleteMany: true,
  deleteOne: true,
  executeRaw: true,
  findFirst: false,
  findFirstOrThrow: false,
  findMany: false,
  findRaw: false,
  findUnique: false,
  findUniqueOrThrow: false,
  groupBy: false,
  queryRaw: false,
  runCommandRaw: true,
  updateMany: true,
  updateOne: true,
  upsertOne: true,
}

export class JsonProtocolMessage implements ProtocolMessage<JsonQuery> {
  constructor(readonly query: JsonQuery) {}

  isWrite(): boolean {
    return isWrite[this.query.action]
  }
  getBatchId(): string | undefined {
    if (this.query.action !== 'findUnique') {
      return undefined
    }
    const parts: string[] = []
    if (this.query.modelName) {
      parts.push(this.query.modelName)
    }

    if (this.query.query.arguments) {
      parts.push(buildKeysString(this.query.query.arguments))
    }
    parts.push(buildKeysString(this.query.query.selection))

    return parts.join('')
  }

  toDebugString(): string {
    return JSON.stringify(this.query, null, 2)
  }

  toEngineQuery(): JsonQuery {
    return this.query
  }

  deserializeResponse(data: unknown, dataPath: string[]): unknown {
    if (!data) {
      return data
    }

    const response = Object.values(data)[0]
    const pathForGet = dataPath.filter((key) => key !== 'select' && key !== 'include')
    return deserializeJsonResponse(deepGet(response, pathForGet))
  }
}

function buildKeysString(obj: object): string {
  const keysArray = Object.keys(obj)
    .sort()
    .map((key) => {
      const value = obj[key]
      if (typeof value === 'object' && value !== null) {
        return `(${key} ${buildKeysString(value)})`
      }
      return key
    })

  return `(${keysArray.join(' ')})`
}
