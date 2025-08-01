import { UserArgs } from './core/request/UserArgs'
import { Action } from './core/types/exported/JsApi'

export type QueryMiddlewareParams = {
  /** The model this is executed on */
  model?: string
  /** The action that is being handled */
  action: Action
  /** TODO what is this */
  dataPath: string[]
  /** TODO what is this */
  runInTransaction: boolean
  args?: UserArgs
}

export type Namespace = 'all' | 'engine'
