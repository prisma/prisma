import type { EngineQuery } from '@prisma/engine-core'

import type { DMMF } from '../../dmmf-types'
import { CallSite } from '../../utils/CallSite'
import { MergedExtensionsList } from '../extensions/MergedExtensionsList'
import { Action, JsArgs } from '../types/JsApi'

export interface ProtocolMessage {
  isWrite(): boolean
  getBatchId(): string | undefined
  toDebugString(): string
  toEngineQuery(): EngineQuery
  deserializeResponse(data: unknown, dataPath: string[]): unknown
}

export type CreateMessageOptions = {
  action: Action
  modelName?: string
  args: JsArgs
  extensions: MergedExtensionsList
  clientMethod: string
  callsite?: CallSite
}

export interface ProtocolEncoder {
  createMessage(options: CreateMessageOptions): ProtocolMessage
}
