import { CallSite } from '../../utils/CallSite'
import type { EngineBatchQuery, EngineQuery } from '../engines'
import { MergedExtensionsList } from '../extensions/MergedExtensionsList'
import { Action, JsArgs } from '../types/JsApi'

export interface ProtocolMessage<EngineQueryType extends EngineQuery = EngineQuery> {
  isWrite(): boolean
  getBatchId(): string | undefined
  toDebugString(): string
  toEngineQuery(): EngineQueryType
  deserializeResponse(data: unknown, dataPath: string[]): unknown
}

export type CreateMessageOptions = {
  action: Action
  modelName?: string
  args?: JsArgs
  extensions: MergedExtensionsList
  clientMethod: string
  callsite?: CallSite
}

export interface ProtocolEncoder<EngineQueryType extends EngineQuery = EngineQuery> {
  createMessage(options: CreateMessageOptions): ProtocolMessage<EngineQueryType>

  createBatch(messages: ProtocolMessage<EngineQueryType>[]): EngineBatchQuery
}
