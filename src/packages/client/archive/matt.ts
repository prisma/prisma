import * as process from 'process'
import { spawn, ChildProcess } from 'child_process'

/**
 * Prisma Client
 */

type Settings = {
  executablePath: string
}

// could be a class if we want to require new Prisma(...)
export default function Prisma(settings: Partial<Settings> = {}) {
  return new PrismaClient({
    executablePath: settings.executablePath || './rust.ts',
  })
}

class PrismaClient {
  constructor(settings: Settings) {}

  async send<T>(query: string): Promise<T> {
    // wait for rust to open (if it's resolved already, should just return immediately)
    // const rust = await this.rust
    console.log(query)
    return {} as T
  }

  async close() {}

  // lazily initialize once and cache
  private _users?: UsersDelegate
  get users() {
    return this._users ? this._users : (this._users = UsersDelegate(this))
  }
}

// User query parameters
type UserQuery = Partial<User>

// User output
type User = {
  id: number
  email: string
  firstName: string
}

// UserDelegate is a helper function to pass our initialized Prisma client to UsersClient
interface UsersDelegate {
  (query: UserQuery): UsersClient
  byEmail(email: string): UsersClient
}
function UsersDelegate(prisma: PrismaClient, from: PostQuery = {}): UsersDelegate {
  //  new UsersClient(...) will be called each time, but I think this is optimized
  // in V8 since we're not dynamically recreating the class each time.
  // TODO: double-check
  const Users = (userQuery: UserQuery) => new UsersClient(prisma, Object.assign(from, userQuery))
  Users.byEmail = (email: string) => new UsersClient(prisma, Object.assign(from, { email }))
  return Users
}

// private user client class
class UsersClient<T = User[]> implements PromiseLike<T> {
  constructor(private readonly prisma: PrismaClient, private readonly userQuery: UserQuery) {}

  // lazily initialize once and cache
  private _posts?: PostsDelegate
  get posts() {
    return this._posts ? this._posts : (this._posts = PostsDelegate(this.prisma, { user: this.userQuery }))
  }

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
    return this.prisma.send<T>(JSON.stringify(this.userQuery)).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.prisma.send<T>(JSON.stringify(this.userQuery)).catch(onrejected)
  }
}

/**
 * Posts
 */

// User query parameters
type PostQuery = Partial<
  | Post
  | {
      user: UserQuery
    }
>

// Post output
type Post = {
  id: number
  slug: string
  title: string
  user?: User
  user_id: number
}

// PostsDelegate is a helper function to pass our initialized Prisma client to PostsClient
interface PostsDelegate {
  (query: PostQuery): PostsClient
  byTitle(email: string): PostsClient
}
function PostsDelegate(prisma: PrismaClient, from: PostQuery = {}): PostsDelegate {
  //  new PostsClient(...) will be called each time, but I think this is optimized
  // in V8 since we're not dynamically recreating the class each time.
  // TODO: double-check
  const Posts = (postQuery: PostQuery) => new PostsClient(prisma, Object.assign(from, postQuery))
  Posts.byTitle = (title: string) => new PostsClient(prisma, Object.assign(from, { title }))
  return Posts
}

// private posts client class
class PostsClient<T = Post[]> implements PromiseLike<T> {
  constructor(private readonly prisma: PrismaClient, private readonly query: PostQuery) {}

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
    return this.prisma.send<T>(JSON.stringify(this.query)).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.prisma.send<T>(JSON.stringify(this.query)).catch(onrejected)
  }
}

// USAGE
async function main() {
  const prisma = Prisma({})
  const users1 = await prisma.users({ id: 10 })
  console.log(users1)
  const users2 = await prisma.users({ id: 20 })
  const users3 = await prisma.users.byEmail('blah@blah.com')
  const usersPosts = await prisma.users({ id: 10 }).posts({ title: 'hi world' })
  await prisma.close()
}

main()
