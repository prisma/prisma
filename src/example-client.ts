import { DMMF } from './dmmf-types'
import fetch from 'node-fetch'
import { DMMFClass } from './dmmf'
import { deepGet } from './utils/deep-set'
import { makeDocument } from './query'
import { Subset } from './generated'

class PrismaFetcher {
  constructor(private readonly url: string) {}
  request<T>(query: string, path: string[] = []): Promise<T> {
    return fetch(this.url, {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      // TODO: More error handling
    })
      .then(res => res.json())
      .then(res => (path.length > 0 ? deepGet(res.data, path) : res.data))
  }
}

type Query_select = {}

type Query_getPayload<S extends Query_select> = {}

class PrismaClient {
  private fetcher?: PrismaFetcher
  private readonly dmmf: DMMFClass
  constructor(dmmf: DMMF.Document) {
    this.dmmf = new DMMFClass(dmmf)
  }
  async connect() {
    // TODO: Spawn Rust
    this.fetcher = new PrismaFetcher('http://localhost:8000')
  }
  async close() {
    // TODO: Kill Rust
  }
  // private _users?: UserDelegate
  // get users() {
  //   return this._users ? this._users : (this._users = UserDelegate(this.fetcher))
  // }
  private _query?: QueryDelegate
  get query() {
    return this._query ? this._query : (this._query = QueryDelegate(this.dmmf, this.fetcher))
  }
}

interface Query_users_args {
  skip: number
  first: number
}
// users(args: {
//   skip: number,
//   first: number
// }): QueryClient
// users(args: Query_users_args): QueryClient

type QueryArgs = {
  users?: UserArgs
  user?: UserArgs
}

interface QueryDelegate {
  <T extends QueryArgs>(args: Subset<T, QueryArgs>): QueryClient
}
function QueryDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): QueryDelegate {
  const Query = (args: QueryArgs) => new QueryClient(dmmf, fetcher, args, [])
  return Query
}

class QueryClient<T = any[]> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly args: QueryArgs,
    private readonly path: [],
  ) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const rootField = Object.keys(this.args)[0]
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: 'query',
      select: this.args[rootField],
    })
    document.validate(this.args[rootField], true)
    return String(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<T>(this.query, this.path).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path).catch(onrejected)
  }
}

/**
 * Next Types to generate
 * One[MODEL]Args
 * Many[MODEL]Args
 * [MODEL]Select
 */

type User = {
  id: string
  name: string
  strings: string[]
}

type UserArgs = {
  first: number
  where: UserWhereInput
  select: UserSelect
}

type UserWhereInput = {
  id: string
}

type UserSelect = {
  id: boolean
  name: boolean
  strings: boolean
}

interface UserDelegate {
  (query: UserArgs): Client
}
function UserDelegate(fetcher: PrismaFetcher, from: any = {}) {
  const Users = (query: any) => new Client(fetcher, Object.assign(from, query))
  return Users
}
