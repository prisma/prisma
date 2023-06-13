import { CallSite } from '../../utils/CallSite'
import { JsonQuery } from '../engines'
import { MergedExtensionsList } from '../extensions/MergedExtensionsList'
import { Action, JsArgs } from '../types/JsApi'

export interface ProtocolMessage<EngineQueryType extends JsonQuery = JsonQuery> {
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

export interface ProtocolEncoder<EngineQueryType extends JsonQuery = JsonQuery> {
  createMessage(options: CreateMessageOptions): ProtocolMessage<EngineQueryType>

  createBatch(messages: ProtocolMessage<EngineQueryType>[]): JsonQuery[]
}
