import { DMMF } from './dmmf-types'
import fetch from 'node-fetch'

class PrismaFetcher {
  constructor(private readonly url: string) {}
  request<T>(query: string): Promise<T> {
    return fetch(this.url, {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }).then(res => res.json())
  }
}

type Query_select = {}

type Query_getPayload<S extends Query_select> = {}

class PrismaClient {
  private fetcher?: PrismaFetcher
  constructor(private readonly dmmf: DMMF.Document) {}
  async connect() {
    // TODO: Spawn Rust
    this.fetcher = new PrismaFetcher('http://localhost:8000')
  }
  async close() {
    // TODO: Kill Rust
  }
  private _users?: UserDelegate
  get users() {
    return this._users ? this._users : (this._users = UserDelegate(this.fetcher))
  }
  get query() {}
}

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
  (query: UserArgs): UserClient
}
function UserDelegate(fetcher: PrismaFetcher, from: any = {}) {
  const Users = (query: any) => new UserClient(fetcher, Object.assign(from, query))
  return Users
}

class UserClient<T = User[]> implements PromiseLike<T> {
  constructor(private readonly fetcher: PrismaFetcher, private readonly query: any) {}
  readonly [Symbol.toStringTag]: 'Promise'
  /**
   * NOTE: Pulled from typescript's: interface Promise<T> { ... }
   * via "Go to definition" on Promise
   */
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
    return this.fetcher.request<T>(JSON.stringify(this.query)).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(JSON.stringify(this.query)).catch(onrejected)
  }
}
