import { EngineQuery } from '@prisma/engine-core'

import { DMMFHelper } from '../../dmmf'
import type { DMMF } from '../../dmmf-types'
import { ErrorFormat } from '../../getPrismaClient'
import { Args, Document, makeDocument, unpack } from '../../query'
import { Action } from '../types/JsApi'
import { CreateMessageOptions, ProtocolEncoder, ProtocolMessage } from './common'

const actionOperationMap: Record<Action, 'query' | 'mutation'> = {
  findUnique: 'query',
  findUniqueOrThrow: 'query',
  findFirst: 'query',
  findFirstOrThrow: 'query',
  findMany: 'query',
  count: 'query',
  create: 'mutation',
  createMany: 'mutation',
  update: 'mutation',
  updateMany: 'mutation',
  upsert: 'mutation',
  delete: 'mutation',
  deleteMany: 'mutation',
  executeRaw: 'mutation',
  queryRaw: 'mutation',
  aggregate: 'query',
  groupBy: 'query',
  runCommandRaw: 'mutation',
  findRaw: 'query',
  aggregateRaw: 'query',
}

export class GraphQLProtocolEncoder implements ProtocolEncoder {
  constructor(private dmmf: DMMFHelper, private errorFormat: ErrorFormat) {}

  createMessage({
    action,
    modelName,
    args,
    extensions,
    clientMethod,
    callsite,
  }: CreateMessageOptions): ProtocolMessage {
    let rootField: string | undefined
    const operation = actionOperationMap[action]

    if (action === 'executeRaw' || action === 'queryRaw' || action === 'runCommandRaw') {
      rootField = action
    }

    let mapping: DMMF.ModelMapping
    if (modelName !== undefined) {
      mapping = this.dmmf?.mappingsMap[modelName]
      if (mapping === undefined) {
        throw new Error(`Could not find mapping for model ${modelName}`)
      }

      rootField = mapping[action === 'count' ? 'aggregate' : action]
    }

    if (operation !== 'query' && operation !== 'mutation') {
      throw new Error(`Invalid operation ${operation} for action ${action}`)
    }

    const field = this.dmmf?.rootFieldMap[rootField!]

    if (field === undefined) {
      throw new Error(
        `Could not find rootField ${rootField} for action ${action} for model ${modelName} on rootType ${operation}`,
      )
    }

    const document = makeDocument({
      dmmf: this.dmmf,
      rootField: rootField!,
      rootTypeName: operation,
      select: args,
      modelName,
      extensions: extensions,
    })

    document.validate(args, false, clientMethod, this.errorFormat, callsite)
    return new GraphQLMessage(document)
  }
}

export class GraphQLMessage implements ProtocolMessage {
  constructor(private document: Document) {}

  isWrite(): boolean {
    return this.document.type === 'mutation'
  }

  getBatchId(): string | undefined {
    if (!this.getRootField().startsWith('findUnique')) {
      return undefined
    }

    // we generate a string for the fields we have used in the `where`
    const args = this.document.children[0].args?.args
      .map((a) => {
        if (a.value instanceof Args) {
          return `${a.key}-${a.value.args.map((a) => a.key).join(',')}`
        }
        return a.key
      })
      .join(',')

    // we generate a string for the fields we have used in the `includes`
    const selectionSet = this.document.children[0].children!.join(',')

    // queries that share this token will be batched and collapsed altogether
    return `${this.document.children[0].name}|${args}|${selectionSet}`
  }

  toDebugString(): string {
    return String(this.document)
  }

  toEngineQuery(): EngineQuery {
    return { query: String(this.document) }
  }

  deserializeResponse(data: unknown, dataPath: string[]): unknown {
    const rootField = this.getRootField()

    const unpackPath: string[] = []
    if (rootField) {
      unpackPath.push(rootField)
    }
    unpackPath.push(...dataPath.filter((p) => p !== 'select' && p !== 'include'))

    return unpack({ document: this.document, path: unpackPath, data })
  }

  private getRootField(): string {
    return this.document.children[0].name
  }
}
