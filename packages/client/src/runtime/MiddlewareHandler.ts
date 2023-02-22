import { Action } from './core/types/JsApi'

export type QueryMiddleware = (
  params: QueryMiddlewareParams,
  next: (params: QueryMiddlewareParams) => Promise<unknown>,
) => Promise<unknown>

export type QueryMiddlewareParams = {
  /** The model this is executed on */
  model?: string
  /** The action that is being handled */
  action: Action
  /** TODO what is this */
  dataPath: string[]
  /** TODO what is this */
  runInTransaction: boolean
  /**
   * Arguments of the query.
   * TODO: There are multiple possible types for `args` based on the contexts it is used in: in some places `UserArgs`
   * from `src/runtime/core/model/UserArgs` is expected, in other -- `object`.  This needs to be unified. Extra care
   * must be taken not to introduce any breaking changes, as exposing `UserArgs` in public APIs (e.g. $runCommandRaw)
   * will be more restrictive than what we currently accept. `UserArgs` type may need to be expanded to allow things
   * like dates and buffers.
   */
  args: any // TODO remove any, does this make sense, what is args?
}

export type Namespace = 'all' | 'engine'

export class MiddlewareHandler<M extends Function> {
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
