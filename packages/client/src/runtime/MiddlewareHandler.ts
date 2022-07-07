import type { Action } from './getPrismaClient'
import type { Document } from './query'

export type QueryMiddleware<T = unknown> = (
  params: QueryMiddlewareParams,
  next: (params: QueryMiddlewareParams) => Promise<T>,
  context: QueryMiddlewareContext,
) => Promise<T>

export type QueryMiddlewareContext = Record<string, string | number | boolean>

export type QueryMiddlewareParams = {
  /** The model this is executed on */
  model?: string
  /** The action that is being handled */
  action: Action
  /** TODO what is this */
  dataPath: string[]
  /** TODO what is this */
  runInTransaction: boolean
  /** TODO what is this */
  args: any // TODO remove any, does this make sense, what is args?
}

export type EngineMiddleware<T = unknown> = (
  params: EngineMiddlewareParams,
  next: (params: EngineMiddlewareParams) => Promise<{ data: T; elapsed: number }>,
) => Promise<{ data: T; elapsed: number }>

export type EngineMiddlewareParams = {
  document: Document
  runInTransaction?: boolean
}

export type Namespace = 'all' | 'engine'

class MiddlewareHandler<M extends Function> {
  private _middlewares: M[] = []

  use(middleware: M) {
    this._middlewares.push(middleware)
  }

  get(id: number): M | undefined {
    return this._middlewares[id]
  }

  has(id: number) {
    return !!this._middlewares[id]
  }

  length() {
    return this._middlewares.length
  }
}

export class Middlewares {
  query = new MiddlewareHandler<QueryMiddleware>()
  engine = new MiddlewareHandler<EngineMiddleware>()
}
