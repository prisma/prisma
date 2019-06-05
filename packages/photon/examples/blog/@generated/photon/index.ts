import { DMMF, DMMFClass, deepGet, deepSet, makeDocument, Engine, debugLib, transformDocument } from '../../../../src/runtime'

const debug = debugLib('photon')

/**
 * Utility Types
 */


export type Enumerable<T> = T | Array<T>

export type MergeTruthyValues<R extends object, S extends object> = {
  [key in keyof S | keyof R]: key extends false
    ? never
    : key extends keyof S
    ? S[key] extends false
      ? never
      : S[key]
    : key extends keyof R
    ? R[key]
    : never
}

export type CleanupNever<T> = { [key in keyof T]: T[key] extends never ? never : key }[keyof T]

type AtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>> 
    & {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]

type OnlyOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>>
    & {
        [K in Keys]-?:
            Required<Pick<T, K>>
            & Partial<Record<Exclude<Keys, K>, undefined>>
    }[Keys]

/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export type Subset<T, U> = { [key in keyof T]: key extends keyof U ? T[key] : never }

class PhotonFetcher {
  private url?: string
  constructor(private readonly engine: Engine, private readonly debug = false) {}
  async request<T>(query: string, path: string[] = [], rootField?: string, typeName?: string): Promise<T> {
    debug(query)
    const result = await this.engine.request(query, typeName)
    debug(result)
    return this.unpack(result, path, rootField)
  }
  protected unpack(result: any, path: string[], rootField?: string) {
    const getPath: string[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter(p => p !== 'select'))
    return deepGet(result, getPath)
  }
}


/**
 * Client
**/




export type Fetcher = (input: {
  query: string
  typeName?: string
}) => Promise<{ data?: any; error?: any; errors?: any }>

export interface PhotonOptions {
  debugEngine?: boolean
  debug?: boolean
  fetcher?: Fetcher
}

export class Photon {
  private fetcher: PhotonFetcher
  private readonly dmmf: DMMFClass
  private readonly engine: Engine
  constructor(options: PhotonOptions = {}) {
    const useDebug = options.debug || false
    if (useDebug) {
      debugLib.enable('photon')
    }
    const debugEngine = options.debugEngine || false
    this.engine = new Engine({
      
      prismaYmlPath: "/Users/tim/code/photon-js/packages/photon/examples/blog/prisma.yml",
      debug: debugEngine,
      datamodel: "model Blog {\n  id: Int @id\n  name: String\n  viewCount: Int\n  posts: Post[]\n  authors: Author[]\n}\n\nmodel Author {\n  id: Int @id\n  name: String?\n  posts: Post[]\n  blog: Blog\n}         \n\nmodel Post {\n  id: Int @id\n  title: String\n  tags: String[]\n  blog: Blog\n}\n",
      prismaConfig: "prototype: true\ndatabases:\n  default:\n    connector: sqlite-native\n    databaseFile: ./db/Chinook.db\n    migrations: true\n    active: true\n    rawAccess: true\n",
      
    })
    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PhotonFetcher(this.engine)
  }
  async connect() {
    // TODO: Provide autoConnect: false option so that this is even needed
    await this.engine.startPromise
  }
  async close() {
    this.engine.stop()
  }
  private _query?: QueryDelegate
  get query(): QueryDelegate {
    return this._query ? this._query: (this._query = QueryDelegate(this.dmmf, this.fetcher))
  }
  private _blogs?: BlogDelegate
  get blogs(): BlogDelegate {
    this.connect()
    return this._blogs? this._blogs : (this._blogs = BlogDelegate(this.dmmf, this.fetcher))
  }
  private _authors?: AuthorDelegate
  get authors(): AuthorDelegate {
    this.connect()
    return this._authors? this._authors : (this._authors = AuthorDelegate(this.dmmf, this.fetcher))
  }
  private _posts?: PostDelegate
  get posts(): PostDelegate {
    this.connect()
    return this._posts? this._posts : (this._posts = PostDelegate(this.dmmf, this.fetcher))
  }
}


/**
 * Query
 */

export type QueryArgs = {
  blog?: FindOneBlogArgs
  blogs?: FindManyBlogArgs
  author?: FindOneAuthorArgs
  authors?: FindManyAuthorArgs
  post?: FindOnePostArgs
  posts?: FindManyPostArgs
}

type QueryGetPayload<S extends QueryArgs> = S extends QueryArgs
  ? {
      [P in keyof S] 
        : P extends 'blogs'
        ? Array<BlogGetPayload<ExtractFindManyBlogArgsSelect<S[P]>>>
        : P extends 'blog'
        ? BlogGetPayload<ExtractFindOneBlogArgsSelect<S[P]>>
        : P extends 'authors'
        ? Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<S[P]>>>
        : P extends 'author'
        ? AuthorGetPayload<ExtractFindOneAuthorArgsSelect<S[P]>>
        : P extends 'posts'
        ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>>
        : P extends 'post'
        ? PostGetPayload<ExtractFindOnePostArgsSelect<S[P]>>
        : never
    } : never
  

interface QueryDelegate {
  <T extends QueryArgs>(args: Subset<T,QueryArgs>): PromiseLike<QueryGetPayload<T>>
}
function QueryDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): QueryDelegate {
  const Query = <T extends QueryArgs>(args: QueryArgs) => new QueryClient<T>(dmmf, fetcher, args, [])
  return Query
}

class QueryClient<T extends QueryArgs, U = QueryGetPayload<T>> implements PromiseLike<U> {
  constructor(private readonly dmmf: DMMFClass, private readonly fetcher: PhotonFetcher, private readonly args: QueryArgs, private readonly path: []) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const rootField = Object.keys(this.args)[0]
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: 'query',
      // @ts-ignore
      select: this.args[rootField]
    })
    // @ts-ignore
    document.validate(this.args[rootField], true)
    return String(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = U, TResult2 = never>(
    onfulfilled?: ((value: U) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<U>(this.query, this.path, undefined, 'Query').then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<U | TResult> {
    return this.fetcher.request<U>(this.query, this.path, undefined, 'Query').catch(onrejected)
  }
}
    


/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

function makeEnum<T extends {[index: string]: U}, U extends string>(x: T) { return x }

export const OrderByArg = makeEnum({
  asc: 'asc',
  desc: 'desc'
})

export type OrderByArg = (typeof OrderByArg)[keyof typeof OrderByArg]



/**
 * Model Blog
 */

export type Blog = {
  id: number
  name: string
  viewCount: number
}

export type BlogScalars = 'id' | 'name' | 'viewCount'
  

export type BlogSelect = {
  id?: boolean
  name?: boolean
  viewCount?: boolean
  posts?: boolean | FindManyPostArgs
  authors?: boolean | FindManyAuthorArgs
}

type BlogDefault = {
  id: true
  name: true
  viewCount: true
}


type BlogGetPayload<S extends boolean | BlogSelect> = S extends true
  ? Blog
  : S extends BlogSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<BlogDefault, S>>]: P extends BlogScalars
        ? Blog[P]
        : P extends 'posts'
        ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>>
        : P extends 'authors'
        ? Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<S[P]>>>
        : never
    }
   : never

export interface BlogDelegate {
  <T extends FindManyBlogArgs>(args?: Subset<T, FindManyBlogArgs>): PromiseLike<Array<BlogGetPayload<ExtractFindManyBlogArgsSelect<T>>>>
  findOne<T extends FindOneBlogArgs>(
    args: Subset<T, FindOneBlogArgs>
  ): 'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractFindOneBlogArgsSelect<T>>> : BlogClient<Blog>
  findMany<T extends FindManyBlogArgs>(
    args?: Subset<T, FindManyBlogArgs>
  ): PromiseLike<Array<BlogGetPayload<ExtractFindManyBlogArgsSelect<T>>>>
  create<T extends BlogCreateArgs>(
    args: Subset<T, BlogCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogCreateArgsSelect<T>>> : BlogClient<Blog>
  update<T extends BlogUpdateArgs>(
    args: Subset<T, BlogUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogUpdateArgsSelect<T>>> : BlogClient<Blog>
}
function BlogDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): BlogDelegate {
  const Blog = <T extends FindManyBlogArgs>(args: Subset<T, FindManyBlogArgs>) => new BlogClient<PromiseLike<Array<BlogGetPayload<ExtractFindManyBlogArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'blogs', 'blogs', args, [])
  Blog.findOne = <T extends FindOneBlogArgs>(args: Subset<T, FindOneBlogArgs>) => args.select ? new BlogClient<'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogArgsSelect<T>>> : BlogClient<Blog>>(
    dmmf,
    fetcher,
    'query',
    'blog',
    'blogs.findOne',
    args,
    []
  ) : new BlogClient<Blog>(
    dmmf,
    fetcher,
    'query',
    'blog',
    'blogs.findOne',
    args,
    []
  )
  Blog.findMany = <T extends FindManyBlogArgs>(args: Subset<T, FindManyBlogArgs>) => new BlogClient<PromiseLike<Array<BlogGetPayload<ExtractFindManyBlogArgsSelect<T>>>>>(
    dmmf,
    fetcher,
    'query',
    'blogs',
    'blogs.findMany',
    args,
    []
  )
  Blog.create = <T extends BlogCreateArgs>(args: Subset<T, BlogCreateArgs>) => args.select ? new BlogClient<'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogArgsSelect<T>>> : BlogClient<Blog>>(
    dmmf,
    fetcher,
    'mutation',
    'createBlog',
    'blogs.create',
    args,
    []
  ) : new BlogClient<Blog>(
    dmmf,
    fetcher,
    'mutation',
    'createBlog',
    'blogs.create',
    args,
    []
  )
  Blog.update = <T extends BlogUpdateArgs>(args: Subset<T, BlogUpdateArgs>) => args.select ? new BlogClient<'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogArgsSelect<T>>> : BlogClient<Blog>>(
    dmmf,
    fetcher,
    'mutation',
    'updateBlog',
    'blogs.update',
    args,
    []
  ) : new BlogClient<Blog>(
    dmmf,
    fetcher,
    'mutation',
    'updateBlog',
    'blogs.update',
    args,
    []
  )
  return Blog as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class BlogClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PhotonFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: BlogArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PhotonPromise'

  private _posts?: PostClient<any>
  posts<T extends FindManyPostArgs = {}>(args?: Subset<T, FindManyPostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'posts']
    const newArgs = deepSet(this.args, path, args || true)
    return this._posts
      ? this._posts
      : (this._posts = new PostClient<PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }
  private _authors?: AuthorClient<any>
  authors<T extends FindManyAuthorArgs = {}>(args?: Subset<T, FindManyAuthorArgs>): PromiseLike<Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'authors']
    const newArgs = deepSet(this.args, path, args || true)
    return this._authors
      ? this._authors
      : (this._authors = new AuthorClient<PromiseLike<Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<T>>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args
    })
    document.validate(this.args, false, this.clientMethod)
    debug(String(document))
    const newDocument = transformDocument(document)
    return String(newDocument)
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
    return this.fetcher.request<T>(this.query, this.path, this.rootField, 'Blog').then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path, this.rootField, 'Blog').catch(onrejected)
  }
}
    

// InputTypes

export type FindOneBlogArgs = {
  select?: BlogSelect
  where: BlogWhereUniqueInput
}

export type FindOneBlogArgsWithSelect = {
  select: BlogSelect
  where: BlogWhereUniqueInput
}

type ExtractFindOneBlogArgsSelect<S extends undefined | boolean | FindOneBlogArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindOneBlogArgsWithSelect
  ? S['select']
  : true


export type FindManyBlogArgs = {
  select?: BlogSelect
  where?: BlogWhereInput
  orderBy?: BlogOrderByInput
  skip?: string
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyBlogArgsWithSelect = {
  select: BlogSelect
  where?: BlogWhereInput
  orderBy?: BlogOrderByInput
  skip?: string
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyBlogArgsSelect<S extends undefined | boolean | FindManyBlogArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindManyBlogArgsWithSelect
  ? S['select']
  : true


export type BlogCreateArgs = {
  select?: BlogSelect
  data: BlogCreateInput
}

export type BlogCreateArgsWithSelect = {
  select: BlogSelect
  data: BlogCreateInput
}

type ExtractBlogCreateArgsSelect<S extends undefined | boolean | BlogCreateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends BlogCreateArgsWithSelect
  ? S['select']
  : true


export type BlogUpdateArgs = {
  select?: BlogSelect
  data: BlogUpdateInput
  where: BlogWhereUniqueInput
}

export type BlogUpdateArgsWithSelect = {
  select: BlogSelect
  data: BlogUpdateInput
  where: BlogWhereUniqueInput
}

type ExtractBlogUpdateArgsSelect<S extends undefined | boolean | BlogUpdateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends BlogUpdateArgsWithSelect
  ? S['select']
  : true


export type BlogArgs = {
  select?: BlogSelect
}

export type BlogArgsWithSelect = {
  select: BlogSelect
}

type ExtractBlogArgsSelect<S extends undefined | boolean | BlogArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends BlogArgsWithSelect
  ? S['select']
  : true



/**
 * Model Author
 */

export type Author = {
  id: number
  name: string | null
}

export type AuthorScalars = 'id' | 'name'
  

export type AuthorSelect = {
  id?: boolean
  name?: boolean
  posts?: boolean | FindManyPostArgs
  blog?: boolean | BlogArgs
}

type AuthorDefault = {
  id: true
  name: true
}


type AuthorGetPayload<S extends boolean | AuthorSelect> = S extends true
  ? Author
  : S extends AuthorSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<AuthorDefault, S>>]: P extends AuthorScalars
        ? Author[P]
        : P extends 'posts'
        ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>>
        : P extends 'blog'
        ? BlogGetPayload<ExtractBlogArgsSelect<S[P]>>
        : never
    }
   : never

export interface AuthorDelegate {
  <T extends FindManyAuthorArgs>(args?: Subset<T, FindManyAuthorArgs>): PromiseLike<Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<T>>>>
  findOne<T extends FindOneAuthorArgs>(
    args: Subset<T, FindOneAuthorArgs>
  ): 'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractFindOneAuthorArgsSelect<T>>> : AuthorClient<Author>
  findMany<T extends FindManyAuthorArgs>(
    args?: Subset<T, FindManyAuthorArgs>
  ): PromiseLike<Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<T>>>>
  create<T extends AuthorCreateArgs>(
    args: Subset<T, AuthorCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractAuthorCreateArgsSelect<T>>> : AuthorClient<Author>
  update<T extends AuthorUpdateArgs>(
    args: Subset<T, AuthorUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractAuthorUpdateArgsSelect<T>>> : AuthorClient<Author>
}
function AuthorDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): AuthorDelegate {
  const Author = <T extends FindManyAuthorArgs>(args: Subset<T, FindManyAuthorArgs>) => new AuthorClient<PromiseLike<Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'authors', 'authors', args, [])
  Author.findOne = <T extends FindOneAuthorArgs>(args: Subset<T, FindOneAuthorArgs>) => args.select ? new AuthorClient<'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractAuthorArgsSelect<T>>> : AuthorClient<Author>>(
    dmmf,
    fetcher,
    'query',
    'author',
    'authors.findOne',
    args,
    []
  ) : new AuthorClient<Author>(
    dmmf,
    fetcher,
    'query',
    'author',
    'authors.findOne',
    args,
    []
  )
  Author.findMany = <T extends FindManyAuthorArgs>(args: Subset<T, FindManyAuthorArgs>) => new AuthorClient<PromiseLike<Array<AuthorGetPayload<ExtractFindManyAuthorArgsSelect<T>>>>>(
    dmmf,
    fetcher,
    'query',
    'authors',
    'authors.findMany',
    args,
    []
  )
  Author.create = <T extends AuthorCreateArgs>(args: Subset<T, AuthorCreateArgs>) => args.select ? new AuthorClient<'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractAuthorArgsSelect<T>>> : AuthorClient<Author>>(
    dmmf,
    fetcher,
    'mutation',
    'createAuthor',
    'authors.create',
    args,
    []
  ) : new AuthorClient<Author>(
    dmmf,
    fetcher,
    'mutation',
    'createAuthor',
    'authors.create',
    args,
    []
  )
  Author.update = <T extends AuthorUpdateArgs>(args: Subset<T, AuthorUpdateArgs>) => args.select ? new AuthorClient<'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractAuthorArgsSelect<T>>> : AuthorClient<Author>>(
    dmmf,
    fetcher,
    'mutation',
    'updateAuthor',
    'authors.update',
    args,
    []
  ) : new AuthorClient<Author>(
    dmmf,
    fetcher,
    'mutation',
    'updateAuthor',
    'authors.update',
    args,
    []
  )
  return Author as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class AuthorClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PhotonFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: AuthorArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PhotonPromise'

  private _posts?: PostClient<any>
  posts<T extends FindManyPostArgs = {}>(args?: Subset<T, FindManyPostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'posts']
    const newArgs = deepSet(this.args, path, args || true)
    return this._posts
      ? this._posts
      : (this._posts = new PostClient<PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }
  private _blog?: BlogClient<any>
  blog<T extends BlogArgs = {}>(args?: Subset<T, BlogArgs>): PromiseLike<Array<BlogGetPayload<ExtractBlogArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'blog']
    const newArgs = deepSet(this.args, path, args || true)
    return this._blog
      ? this._blog
      : (this._blog = new BlogClient<'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogArgsSelect<T>>> : BlogClient<Blog>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args
    })
    document.validate(this.args, false, this.clientMethod)
    debug(String(document))
    const newDocument = transformDocument(document)
    return String(newDocument)
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
    return this.fetcher.request<T>(this.query, this.path, this.rootField, 'Author').then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path, this.rootField, 'Author').catch(onrejected)
  }
}
    

// InputTypes

export type FindOneAuthorArgs = {
  select?: AuthorSelect
  where: AuthorWhereUniqueInput
}

export type FindOneAuthorArgsWithSelect = {
  select: AuthorSelect
  where: AuthorWhereUniqueInput
}

type ExtractFindOneAuthorArgsSelect<S extends undefined | boolean | FindOneAuthorArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindOneAuthorArgsWithSelect
  ? S['select']
  : true


export type FindManyAuthorArgs = {
  select?: AuthorSelect
  where?: AuthorWhereInput
  orderBy?: AuthorOrderByInput
  skip?: string
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyAuthorArgsWithSelect = {
  select: AuthorSelect
  where?: AuthorWhereInput
  orderBy?: AuthorOrderByInput
  skip?: string
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyAuthorArgsSelect<S extends undefined | boolean | FindManyAuthorArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindManyAuthorArgsWithSelect
  ? S['select']
  : true


export type AuthorCreateArgs = {
  select?: AuthorSelect
  data: AuthorCreateInput
}

export type AuthorCreateArgsWithSelect = {
  select: AuthorSelect
  data: AuthorCreateInput
}

type ExtractAuthorCreateArgsSelect<S extends undefined | boolean | AuthorCreateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends AuthorCreateArgsWithSelect
  ? S['select']
  : true


export type AuthorUpdateArgs = {
  select?: AuthorSelect
  data: AuthorUpdateInput
  where: AuthorWhereUniqueInput
}

export type AuthorUpdateArgsWithSelect = {
  select: AuthorSelect
  data: AuthorUpdateInput
  where: AuthorWhereUniqueInput
}

type ExtractAuthorUpdateArgsSelect<S extends undefined | boolean | AuthorUpdateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends AuthorUpdateArgsWithSelect
  ? S['select']
  : true


export type AuthorArgs = {
  select?: AuthorSelect
}

export type AuthorArgsWithSelect = {
  select: AuthorSelect
}

type ExtractAuthorArgsSelect<S extends undefined | boolean | AuthorArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends AuthorArgsWithSelect
  ? S['select']
  : true



/**
 * Model Post
 */

export type Post = {
  id: number
  title: string
  tags: string[]
}

export type PostScalars = 'id' | 'title' | 'tags'
  

export type PostSelect = {
  id?: boolean
  title?: boolean
  tags?: boolean
  blog?: boolean | BlogArgs
  author?: boolean | AuthorArgs
}

type PostDefault = {
  id: true
  title: true
  tags: true
}


type PostGetPayload<S extends boolean | PostSelect> = S extends true
  ? Post
  : S extends PostSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<PostDefault, S>>]: P extends PostScalars
        ? Post[P]
        : P extends 'blog'
        ? BlogGetPayload<ExtractBlogArgsSelect<S[P]>>
        : P extends 'author'
        ? AuthorGetPayload<ExtractAuthorArgsSelect<S[P]>>
        : never
    }
   : never

export interface PostDelegate {
  <T extends FindManyPostArgs>(args?: Subset<T, FindManyPostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>
  findOne<T extends FindOnePostArgs>(
    args: Subset<T, FindOnePostArgs>
  ): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractFindOnePostArgsSelect<T>>> : PostClient<Post>
  findMany<T extends FindManyPostArgs>(
    args?: Subset<T, FindManyPostArgs>
  ): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>
  create<T extends PostCreateArgs>(
    args: Subset<T, PostCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostCreateArgsSelect<T>>> : PostClient<Post>
  update<T extends PostUpdateArgs>(
    args: Subset<T, PostUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostUpdateArgsSelect<T>>> : PostClient<Post>
}
function PostDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): PostDelegate {
  const Post = <T extends FindManyPostArgs>(args: Subset<T, FindManyPostArgs>) => new PostClient<PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'posts', 'posts', args, [])
  Post.findOne = <T extends FindOnePostArgs>(args: Subset<T, FindOnePostArgs>) => args.select ? new PostClient<'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostArgsSelect<T>>> : PostClient<Post>>(
    dmmf,
    fetcher,
    'query',
    'post',
    'posts.findOne',
    args,
    []
  ) : new PostClient<Post>(
    dmmf,
    fetcher,
    'query',
    'post',
    'posts.findOne',
    args,
    []
  )
  Post.findMany = <T extends FindManyPostArgs>(args: Subset<T, FindManyPostArgs>) => new PostClient<PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>>(
    dmmf,
    fetcher,
    'query',
    'posts',
    'posts.findMany',
    args,
    []
  )
  Post.create = <T extends PostCreateArgs>(args: Subset<T, PostCreateArgs>) => args.select ? new PostClient<'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostArgsSelect<T>>> : PostClient<Post>>(
    dmmf,
    fetcher,
    'mutation',
    'createPost',
    'posts.create',
    args,
    []
  ) : new PostClient<Post>(
    dmmf,
    fetcher,
    'mutation',
    'createPost',
    'posts.create',
    args,
    []
  )
  Post.update = <T extends PostUpdateArgs>(args: Subset<T, PostUpdateArgs>) => args.select ? new PostClient<'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostArgsSelect<T>>> : PostClient<Post>>(
    dmmf,
    fetcher,
    'mutation',
    'updatePost',
    'posts.update',
    args,
    []
  ) : new PostClient<Post>(
    dmmf,
    fetcher,
    'mutation',
    'updatePost',
    'posts.update',
    args,
    []
  )
  return Post as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class PostClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PhotonFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: PostArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PhotonPromise'

  private _blog?: BlogClient<any>
  blog<T extends BlogArgs = {}>(args?: Subset<T, BlogArgs>): PromiseLike<Array<BlogGetPayload<ExtractBlogArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'blog']
    const newArgs = deepSet(this.args, path, args || true)
    return this._blog
      ? this._blog
      : (this._blog = new BlogClient<'select' extends keyof T ? PromiseLike<BlogGetPayload<ExtractBlogArgsSelect<T>>> : BlogClient<Blog>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }
  private _author?: AuthorClient<any>
  author<T extends AuthorArgs = {}>(args?: Subset<T, AuthorArgs>): PromiseLike<Array<AuthorGetPayload<ExtractAuthorArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'author']
    const newArgs = deepSet(this.args, path, args || true)
    return this._author
      ? this._author
      : (this._author = new AuthorClient<'select' extends keyof T ? PromiseLike<AuthorGetPayload<ExtractAuthorArgsSelect<T>>> : AuthorClient<Author>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args
    })
    document.validate(this.args, false, this.clientMethod)
    debug(String(document))
    const newDocument = transformDocument(document)
    return String(newDocument)
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
    return this.fetcher.request<T>(this.query, this.path, this.rootField, 'Post').then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path, this.rootField, 'Post').catch(onrejected)
  }
}
    

// InputTypes

export type FindOnePostArgs = {
  select?: PostSelect
  where: PostWhereUniqueInput
}

export type FindOnePostArgsWithSelect = {
  select: PostSelect
  where: PostWhereUniqueInput
}

type ExtractFindOnePostArgsSelect<S extends undefined | boolean | FindOnePostArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindOnePostArgsWithSelect
  ? S['select']
  : true


export type FindManyPostArgs = {
  select?: PostSelect
  where?: PostWhereInput
  orderBy?: PostOrderByInput
  skip?: string
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyPostArgsWithSelect = {
  select: PostSelect
  where?: PostWhereInput
  orderBy?: PostOrderByInput
  skip?: string
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyPostArgsSelect<S extends undefined | boolean | FindManyPostArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindManyPostArgsWithSelect
  ? S['select']
  : true


export type PostCreateArgs = {
  select?: PostSelect
  data: PostCreateInput
}

export type PostCreateArgsWithSelect = {
  select: PostSelect
  data: PostCreateInput
}

type ExtractPostCreateArgsSelect<S extends undefined | boolean | PostCreateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends PostCreateArgsWithSelect
  ? S['select']
  : true


export type PostUpdateArgs = {
  select?: PostSelect
  data: PostUpdateInput
  where: PostWhereUniqueInput
}

export type PostUpdateArgsWithSelect = {
  select: PostSelect
  data: PostUpdateInput
  where: PostWhereUniqueInput
}

type ExtractPostUpdateArgsSelect<S extends undefined | boolean | PostUpdateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends PostUpdateArgsWithSelect
  ? S['select']
  : true


export type PostArgs = {
  select?: PostSelect
}

export type PostArgsWithSelect = {
  select: PostSelect
}

type ExtractPostArgsSelect<S extends undefined | boolean | PostArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends PostArgsWithSelect
  ? S['select']
  : true



/**
 * Deep Input Types
 */


export type AuthorWhereInput = {
  id?: number | IntFilter
  name?: string | NullableStringFilter | null
  posts?: PostFilter
  AND?: Enumerable<AuthorWhereInput>
  OR?: Enumerable<AuthorWhereInput>
  NOT?: Enumerable<AuthorWhereInput>
  blog?: BlogWhereInput
}

export type PostWhereInput = {
  id?: number | IntFilter
  title?: string | StringFilter
  AND?: Enumerable<PostWhereInput>
  OR?: Enumerable<PostWhereInput>
  NOT?: Enumerable<PostWhereInput>
  blog?: BlogWhereInput
  author?: AuthorWhereInput
}

export type BlogWhereInput = {
  id?: number | IntFilter
  name?: string | StringFilter
  viewCount?: number | IntFilter
  posts?: PostFilter
  authors?: AuthorFilter
  AND?: Enumerable<BlogWhereInput>
  OR?: Enumerable<BlogWhereInput>
  NOT?: Enumerable<BlogWhereInput>
}

export type BlogWhereUniqueInput = {
  id?: number
}

export type AuthorWhereUniqueInput = {
  id?: number
}

export type PostWhereUniqueInput = {
  id?: number
}

export type PostCreatetagsInput = {
  set?: Enumerable<string>
}

export type BlogCreateWithoutAuthorsInput = {
  name: string
  viewCount: number
  posts?: PostCreateManyWithoutPostsInput
}

export type BlogCreateOneWithoutBlogInput = {
  create?: BlogCreateWithoutAuthorsInput
  connect?: BlogWhereUniqueInput
}

export type AuthorCreateWithoutPostsInput = {
  name?: string
  blog: BlogCreateOneWithoutBlogInput
}

export type AuthorCreateOneWithoutAuthorInput = {
  create?: AuthorCreateWithoutPostsInput
  connect?: AuthorWhereUniqueInput
}

export type PostCreateWithoutBlogInput = {
  title: string
  tags?: PostCreatetagsInput
  author?: AuthorCreateOneWithoutAuthorInput
}

export type PostCreateManyWithoutPostsInput = {
  create?: Enumerable<PostCreateWithoutBlogInput>
  connect?: Enumerable<PostWhereUniqueInput>
}

export type AuthorCreateWithoutBlogInput = {
  name?: string
  posts?: PostCreateManyWithoutPostsInput
}

export type AuthorCreateManyWithoutAuthorsInput = {
  create?: Enumerable<AuthorCreateWithoutBlogInput>
  connect?: Enumerable<AuthorWhereUniqueInput>
}

export type BlogCreateInput = {
  name: string
  viewCount: number
  posts?: PostCreateManyWithoutPostsInput
  authors?: AuthorCreateManyWithoutAuthorsInput
}

export type PostUpdatetagsInput = {
  set?: Enumerable<string>
}

export type BlogUpdateWithoutAuthorsDataInput = {
  name?: string
  viewCount?: number
  posts?: PostUpdateManyWithoutPostsInput
}

export type BlogUpdateOneRequiredWithoutBlogInput = {
  create?: BlogCreateWithoutAuthorsInput
  connect?: BlogWhereUniqueInput
  update?: BlogUpdateWithoutAuthorsDataInput
}

export type AuthorUpdateWithoutPostsDataInput = {
  name?: string
  blog: BlogUpdateOneRequiredWithoutBlogInput
}

export type AuthorUpdateOneWithoutAuthorInput = {
  create?: AuthorCreateWithoutPostsInput
  connect?: AuthorWhereUniqueInput
  disconnect?: boolean
  update?: AuthorUpdateWithoutPostsDataInput
}

export type PostUpdateWithoutBlogDataInput = {
  title?: string
  tags?: PostUpdatetagsInput
  author?: AuthorUpdateOneWithoutAuthorInput
}

export type PostUpdateWithWhereUniqueWithoutBlogInput = {
  where: PostWhereUniqueInput
  data: PostUpdateWithoutBlogDataInput
}

export type PostUpdateManyWithoutPostsInput = {
  create?: Enumerable<PostCreateWithoutBlogInput>
  connect?: Enumerable<PostWhereUniqueInput>
  set?: Enumerable<PostWhereUniqueInput>
  disconnect?: Enumerable<PostWhereUniqueInput>
  update?: Enumerable<PostUpdateWithWhereUniqueWithoutBlogInput>
}

export type AuthorUpdateWithoutBlogDataInput = {
  name?: string
  posts?: PostUpdateManyWithoutPostsInput
}

export type AuthorUpdateWithWhereUniqueWithoutBlogInput = {
  where: AuthorWhereUniqueInput
  data: AuthorUpdateWithoutBlogDataInput
}

export type AuthorUpdateManyWithoutAuthorsInput = {
  create?: Enumerable<AuthorCreateWithoutBlogInput>
  connect?: Enumerable<AuthorWhereUniqueInput>
  set?: Enumerable<AuthorWhereUniqueInput>
  disconnect?: Enumerable<AuthorWhereUniqueInput>
  update?: Enumerable<AuthorUpdateWithWhereUniqueWithoutBlogInput>
}

export type BlogUpdateInput = {
  name?: string
  viewCount?: number
  posts?: PostUpdateManyWithoutPostsInput
  authors?: AuthorUpdateManyWithoutAuthorsInput
}

export type AuthorCreateInput = {
  name?: string
  posts?: PostCreateManyWithoutPostsInput
  blog: BlogCreateOneWithoutBlogInput
}

export type AuthorUpdateInput = {
  name?: string
  posts?: PostUpdateManyWithoutPostsInput
  blog: BlogUpdateOneRequiredWithoutBlogInput
}

export type PostCreateInput = {
  title: string
  tags?: PostCreatetagsInput
  blog: BlogCreateOneWithoutBlogInput
  author?: AuthorCreateOneWithoutAuthorInput
}

export type PostUpdateInput = {
  title?: string
  tags?: PostUpdatetagsInput
  blog: BlogUpdateOneRequiredWithoutBlogInput
  author?: AuthorUpdateOneWithoutAuthorInput
}

export type IntFilter = {
  equals?: number
  not?: number | IntFilter
  in?: Enumerable<number>
  notIn?: Enumerable<number>
  lt?: number
  lte?: number
  gt?: number
  gte?: number
}

export type NullableStringFilter = {
  equals?: string | null
  not?: string | null | NullableStringFilter
  in?: Enumerable<string>
  notIn?: Enumerable<string>
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
}

export type PostFilter = {
  every?: PostWhereInput
  some?: PostWhereInput
  none?: PostWhereInput
}

export type StringFilter = {
  equals?: string
  not?: string | StringFilter
  in?: Enumerable<string>
  notIn?: Enumerable<string>
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
}

export type AuthorFilter = {
  every?: AuthorWhereInput
  some?: AuthorWhereInput
  none?: AuthorWhereInput
}

export type BlogOrderByInput = {
  id?: OrderByArg
  name?: OrderByArg
  viewCount?: OrderByArg
}

export type AuthorOrderByInput = {
  id?: OrderByArg
  name?: OrderByArg
}

export type PostOrderByInput = {
  id?: OrderByArg
  title?: OrderByArg
}

/**
 * DMMF
 */

const dmmf: DMMF.Document = {"datamodel":{"enums":[],"models":[{"name":"Blog","isEmbedded":false,"dbName":null,"fields":[{"name":"id","kind":"scalar","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":true,"type":"Int","isGenerated":false},{"name":"name","kind":"scalar","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":false,"type":"String","isGenerated":false},{"name":"viewCount","kind":"scalar","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":false,"type":"Int","isGenerated":false},{"name":"posts","kind":"object","dbName":null,"isList":true,"isRequired":false,"isUnique":false,"isId":false,"type":"Post","relationName":"BlogToPost","relationToFields":[],"relationOnDelete":"NONE","isGenerated":false},{"name":"authors","kind":"object","dbName":null,"isList":true,"isRequired":false,"isUnique":false,"isId":false,"type":"Author","relationName":"AuthorToBlog","relationToFields":[],"relationOnDelete":"NONE","isGenerated":false}]},{"name":"Author","isEmbedded":false,"dbName":null,"fields":[{"name":"id","kind":"scalar","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":true,"type":"Int","isGenerated":false},{"name":"name","kind":"scalar","dbName":null,"isList":false,"isRequired":false,"isUnique":false,"isId":false,"type":"String","isGenerated":false},{"name":"posts","kind":"object","dbName":null,"isList":true,"isRequired":false,"isUnique":false,"isId":false,"type":"Post","relationName":"AuthorToPost","relationToFields":[],"relationOnDelete":"NONE","isGenerated":false},{"name":"blog","kind":"object","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":false,"type":"Blog","relationName":"AuthorToBlog","relationToFields":["id"],"relationOnDelete":"NONE","isGenerated":false}]},{"name":"Post","isEmbedded":false,"dbName":null,"fields":[{"name":"id","kind":"scalar","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":true,"type":"Int","isGenerated":false},{"name":"title","kind":"scalar","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":false,"type":"String","isGenerated":false},{"name":"tags","kind":"scalar","dbName":null,"isList":true,"isRequired":false,"isUnique":false,"isId":false,"type":"String","isGenerated":false},{"name":"blog","kind":"object","dbName":null,"isList":false,"isRequired":true,"isUnique":false,"isId":false,"type":"Blog","relationName":"BlogToPost","relationToFields":["id"],"relationOnDelete":"NONE","isGenerated":false},{"name":"author","kind":"object","dbName":null,"isList":false,"isRequired":false,"isUnique":false,"isId":false,"type":"Author","relationName":"AuthorToPost","relationToFields":["id"],"relationOnDelete":"NONE","isGenerated":true}]}]},"mappings":[{"model":"Blog","findOne":"blog","findMany":"blogs","create":"createBlog","update":"updateBlog","updateMany":null,"upsert":null,"delete":null,"deleteMany":null},{"model":"Author","findOne":"author","findMany":"authors","create":"createAuthor","update":"updateAuthor","updateMany":null,"upsert":null,"delete":null,"deleteMany":null},{"model":"Post","findOne":"post","findMany":"posts","create":"createPost","update":"updatePost","updateMany":null,"upsert":null,"delete":null,"deleteMany":null}],"schema":{"enums":[{"name":"OrderByArg","values":["asc","desc"]}],"outputTypes":[{"name":"Author","fields":[{"name":"id","args":[],"outputType":{"type":"Int","kind":"scalar","isRequired":true,"isList":false}},{"name":"name","args":[],"outputType":{"type":"String","kind":"scalar","isRequired":false,"isList":false}},{"name":"posts","args":[{"name":"where","inputType":[{"type":"AuthorWhereInput","kind":"object","isRequired":false,"isList":false}]},{"name":"orderBy","inputType":[{"type":"AuthorOrderByInput","kind":"enum","isRequired":false,"isList":false}]},{"name":"skip","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"after","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"before","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"first","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"last","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}],"outputType":{"type":"Post","kind":"object","isRequired":false,"isList":true}},{"name":"blog","args":[],"outputType":{"type":"Blog","kind":"object","isRequired":true,"isList":false}}]},{"name":"Post","fields":[{"name":"id","args":[],"outputType":{"type":"Int","kind":"scalar","isRequired":true,"isList":false}},{"name":"title","args":[],"outputType":{"type":"String","kind":"scalar","isRequired":true,"isList":false}},{"name":"tags","args":[],"outputType":{"type":"String","kind":"scalar","isRequired":true,"isList":true}},{"name":"blog","args":[],"outputType":{"type":"Blog","kind":"object","isRequired":true,"isList":false}},{"name":"author","args":[],"outputType":{"type":"Author","kind":"object","isRequired":false,"isList":false}}]},{"name":"Blog","fields":[{"name":"id","args":[],"outputType":{"type":"Int","kind":"scalar","isRequired":true,"isList":false}},{"name":"name","args":[],"outputType":{"type":"String","kind":"scalar","isRequired":true,"isList":false}},{"name":"viewCount","args":[],"outputType":{"type":"Int","kind":"scalar","isRequired":true,"isList":false}},{"name":"posts","args":[{"name":"where","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":false}]},{"name":"orderBy","inputType":[{"type":"BlogOrderByInput","kind":"enum","isRequired":false,"isList":false}]},{"name":"skip","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"after","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"before","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"first","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"last","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}],"outputType":{"type":"Post","kind":"object","isRequired":false,"isList":true}},{"name":"authors","args":[{"name":"where","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":false}]},{"name":"orderBy","inputType":[{"type":"BlogOrderByInput","kind":"enum","isRequired":false,"isList":false}]},{"name":"skip","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"after","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"before","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"first","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"last","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}],"outputType":{"type":"Author","kind":"object","isRequired":false,"isList":true}}]},{"name":"Query","fields":[{"name":"blogs","args":[{"name":"where","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":false}]},{"name":"orderBy","inputType":[{"type":"BlogOrderByInput","kind":"enum","isRequired":false,"isList":false}]},{"name":"skip","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"after","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"before","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"first","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"last","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}],"outputType":{"type":"Blog","kind":"object","isRequired":false,"isList":true}},{"name":"blog","args":[{"name":"where","inputType":[{"type":"BlogWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Blog","kind":"object","isRequired":false,"isList":false}},{"name":"authors","args":[{"name":"where","inputType":[{"type":"AuthorWhereInput","kind":"object","isRequired":false,"isList":false}]},{"name":"orderBy","inputType":[{"type":"AuthorOrderByInput","kind":"enum","isRequired":false,"isList":false}]},{"name":"skip","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"after","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"before","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"first","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"last","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}],"outputType":{"type":"Author","kind":"object","isRequired":false,"isList":true}},{"name":"author","args":[{"name":"where","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Author","kind":"object","isRequired":false,"isList":false}},{"name":"posts","args":[{"name":"where","inputType":[{"type":"PostWhereInput","kind":"object","isRequired":false,"isList":false}]},{"name":"orderBy","inputType":[{"type":"PostOrderByInput","kind":"enum","isRequired":false,"isList":false}]},{"name":"skip","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"after","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"before","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"first","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"last","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}],"outputType":{"type":"Post","kind":"object","isRequired":false,"isList":true}},{"name":"post","args":[{"name":"where","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Post","kind":"object","isRequired":false,"isList":false}}]},{"name":"Mutation","fields":[{"name":"createBlog","args":[{"name":"data","inputType":[{"type":"BlogCreateInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Blog","kind":"object","isRequired":true,"isList":false}},{"name":"updateBlog","args":[{"name":"data","inputType":[{"type":"BlogUpdateInput","kind":"object","isRequired":true,"isList":false}]},{"name":"where","inputType":[{"type":"BlogWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Blog","kind":"object","isRequired":false,"isList":false}},{"name":"createAuthor","args":[{"name":"data","inputType":[{"type":"AuthorCreateInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Author","kind":"object","isRequired":true,"isList":false}},{"name":"updateAuthor","args":[{"name":"data","inputType":[{"type":"AuthorUpdateInput","kind":"object","isRequired":true,"isList":false}]},{"name":"where","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Author","kind":"object","isRequired":false,"isList":false}},{"name":"createPost","args":[{"name":"data","inputType":[{"type":"PostCreateInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Post","kind":"object","isRequired":true,"isList":false}},{"name":"updatePost","args":[{"name":"data","inputType":[{"type":"PostUpdateInput","kind":"object","isRequired":true,"isList":false}]},{"name":"where","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]}],"outputType":{"type":"Post","kind":"object","isRequired":false,"isList":false}}]}],"inputTypes":[{"name":"AuthorWhereInput","fields":[{"name":"id","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"},{"type":"IntFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"name","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"},{"type":"NullableStringFilter","isList":false,"isRequired":false,"kind":"object"},{"type":"null","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false},{"name":"posts","inputType":[{"type":"PostFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"AND","inputType":[{"type":"AuthorWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"OR","inputType":[{"type":"AuthorWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"NOT","inputType":[{"type":"AuthorWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"blog","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":false}],"isRelationFilter":true}],"isWhereType":true,"atLeastOne":true},{"name":"PostWhereInput","fields":[{"name":"id","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"},{"type":"IntFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"title","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"},{"type":"StringFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"AND","inputType":[{"type":"PostWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"OR","inputType":[{"type":"PostWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"NOT","inputType":[{"type":"PostWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"blog","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":false}],"isRelationFilter":true},{"name":"author","inputType":[{"type":"AuthorWhereInput","kind":"object","isRequired":false,"isList":false}],"isRelationFilter":true}],"isWhereType":true,"atLeastOne":true},{"name":"BlogWhereInput","fields":[{"name":"id","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"},{"type":"IntFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"name","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"},{"type":"StringFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"viewCount","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"},{"type":"IntFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"posts","inputType":[{"type":"PostFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"authors","inputType":[{"type":"AuthorFilter","isList":false,"isRequired":false,"kind":"object"}],"isRelationFilter":false},{"name":"AND","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"OR","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true},{"name":"NOT","inputType":[{"type":"BlogWhereInput","kind":"object","isRequired":false,"isList":true}],"isRelationFilter":true}],"isWhereType":true,"atLeastOne":true},{"name":"BlogWhereUniqueInput","fields":[{"name":"id","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}]},{"name":"AuthorWhereUniqueInput","fields":[{"name":"id","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}]},{"name":"PostWhereUniqueInput","fields":[{"name":"id","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]}]},{"name":"PostCreatetagsInput","fields":[{"name":"set","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":true}]}]},{"name":"BlogCreateWithoutAuthorsInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":true,"isList":false}]},{"name":"viewCount","inputType":[{"type":"Int","kind":"scalar","isRequired":true,"isList":false}]},{"name":"posts","inputType":[{"type":"PostCreateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"BlogCreateOneWithoutBlogInput","fields":[{"name":"create","inputType":[{"type":"BlogCreateWithoutAuthorsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"connect","inputType":[{"type":"BlogWhereUniqueInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"AuthorCreateWithoutPostsInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"blog","inputType":[{"type":"BlogCreateOneWithoutBlogInput","kind":"object","isRequired":true,"isList":false}]}]},{"name":"AuthorCreateOneWithoutAuthorInput","fields":[{"name":"create","inputType":[{"type":"AuthorCreateWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"connect","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"PostCreateWithoutBlogInput","fields":[{"name":"title","inputType":[{"type":"String","kind":"scalar","isRequired":true,"isList":false}]},{"name":"tags","inputType":[{"type":"PostCreatetagsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"author","inputType":[{"type":"AuthorCreateOneWithoutAuthorInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"PostCreateManyWithoutPostsInput","fields":[{"name":"create","inputType":[{"type":"PostCreateWithoutBlogInput","kind":"object","isRequired":false,"isList":true}]},{"name":"connect","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]}]},{"name":"AuthorCreateWithoutBlogInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"posts","inputType":[{"type":"PostCreateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"AuthorCreateManyWithoutAuthorsInput","fields":[{"name":"create","inputType":[{"type":"AuthorCreateWithoutBlogInput","kind":"object","isRequired":false,"isList":true}]},{"name":"connect","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]}]},{"name":"BlogCreateInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":true,"isList":false}]},{"name":"viewCount","inputType":[{"type":"Int","kind":"scalar","isRequired":true,"isList":false}]},{"name":"posts","inputType":[{"type":"PostCreateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"authors","inputType":[{"type":"AuthorCreateManyWithoutAuthorsInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"PostUpdatetagsInput","fields":[{"name":"set","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":true}]}]},{"name":"BlogUpdateWithoutAuthorsDataInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"viewCount","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"posts","inputType":[{"type":"PostUpdateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"BlogUpdateOneRequiredWithoutBlogInput","fields":[{"name":"create","inputType":[{"type":"BlogCreateWithoutAuthorsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"connect","inputType":[{"type":"BlogWhereUniqueInput","kind":"object","isRequired":false,"isList":false}]},{"name":"update","inputType":[{"type":"BlogUpdateWithoutAuthorsDataInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"AuthorUpdateWithoutPostsDataInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"blog","inputType":[{"type":"BlogUpdateOneRequiredWithoutBlogInput","kind":"object","isRequired":true,"isList":false}]}]},{"name":"AuthorUpdateOneWithoutAuthorInput","fields":[{"name":"create","inputType":[{"type":"AuthorCreateWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"connect","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":false,"isList":false}]},{"name":"disconnect","inputType":[{"type":"Boolean","kind":"scalar","isRequired":false,"isList":false}]},{"name":"update","inputType":[{"type":"AuthorUpdateWithoutPostsDataInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"PostUpdateWithoutBlogDataInput","fields":[{"name":"title","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"tags","inputType":[{"type":"PostUpdatetagsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"author","inputType":[{"type":"AuthorUpdateOneWithoutAuthorInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"PostUpdateWithWhereUniqueWithoutBlogInput","fields":[{"name":"where","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]},{"name":"data","inputType":[{"type":"PostUpdateWithoutBlogDataInput","kind":"object","isRequired":true,"isList":false}]}]},{"name":"PostUpdateManyWithoutPostsInput","fields":[{"name":"create","inputType":[{"type":"PostCreateWithoutBlogInput","kind":"object","isRequired":false,"isList":true}]},{"name":"connect","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]},{"name":"set","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]},{"name":"disconnect","inputType":[{"type":"PostWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]},{"name":"update","inputType":[{"type":"PostUpdateWithWhereUniqueWithoutBlogInput","kind":"object","isRequired":false,"isList":true}]}]},{"name":"AuthorUpdateWithoutBlogDataInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"posts","inputType":[{"type":"PostUpdateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"AuthorUpdateWithWhereUniqueWithoutBlogInput","fields":[{"name":"where","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":true,"isList":false}]},{"name":"data","inputType":[{"type":"AuthorUpdateWithoutBlogDataInput","kind":"object","isRequired":true,"isList":false}]}]},{"name":"AuthorUpdateManyWithoutAuthorsInput","fields":[{"name":"create","inputType":[{"type":"AuthorCreateWithoutBlogInput","kind":"object","isRequired":false,"isList":true}]},{"name":"connect","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]},{"name":"set","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]},{"name":"disconnect","inputType":[{"type":"AuthorWhereUniqueInput","kind":"object","isRequired":false,"isList":true}]},{"name":"update","inputType":[{"type":"AuthorUpdateWithWhereUniqueWithoutBlogInput","kind":"object","isRequired":false,"isList":true}]}]},{"name":"BlogUpdateInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"viewCount","inputType":[{"type":"Int","kind":"scalar","isRequired":false,"isList":false}]},{"name":"posts","inputType":[{"type":"PostUpdateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"authors","inputType":[{"type":"AuthorUpdateManyWithoutAuthorsInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"AuthorCreateInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"posts","inputType":[{"type":"PostCreateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"blog","inputType":[{"type":"BlogCreateOneWithoutBlogInput","kind":"object","isRequired":true,"isList":false}]}]},{"name":"AuthorUpdateInput","fields":[{"name":"name","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"posts","inputType":[{"type":"PostUpdateManyWithoutPostsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"blog","inputType":[{"type":"BlogUpdateOneRequiredWithoutBlogInput","kind":"object","isRequired":true,"isList":false}]}]},{"name":"PostCreateInput","fields":[{"name":"title","inputType":[{"type":"String","kind":"scalar","isRequired":true,"isList":false}]},{"name":"tags","inputType":[{"type":"PostCreatetagsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"blog","inputType":[{"type":"BlogCreateOneWithoutBlogInput","kind":"object","isRequired":true,"isList":false}]},{"name":"author","inputType":[{"type":"AuthorCreateOneWithoutAuthorInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"PostUpdateInput","fields":[{"name":"title","inputType":[{"type":"String","kind":"scalar","isRequired":false,"isList":false}]},{"name":"tags","inputType":[{"type":"PostUpdatetagsInput","kind":"object","isRequired":false,"isList":false}]},{"name":"blog","inputType":[{"type":"BlogUpdateOneRequiredWithoutBlogInput","kind":"object","isRequired":true,"isList":false}]},{"name":"author","inputType":[{"type":"AuthorUpdateOneWithoutAuthorInput","kind":"object","isRequired":false,"isList":false}]}]},{"name":"IntFilter","fields":[{"name":"equals","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"}]},{"name":"not","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"},{"isList":false,"isRequired":false,"kind":"scalar","type":"IntFilter"}]},{"name":"in","inputType":[{"isList":true,"isRequired":false,"kind":"scalar","type":"Int"}]},{"name":"notIn","inputType":[{"isList":true,"isRequired":false,"kind":"scalar","type":"Int"}]},{"name":"lt","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"}]},{"name":"lte","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"}]},{"name":"gt","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"}]},{"name":"gte","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"Int"}]}],"atLeastOne":true},{"name":"NullableStringFilter","fields":[{"name":"equals","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"},{"isList":false,"isRequired":false,"kind":"scalar","type":"null"}]},{"name":"not","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"},{"isList":false,"isRequired":false,"kind":"scalar","type":"null"},{"isList":false,"isRequired":false,"kind":"scalar","type":"NullableStringFilter"}]},{"name":"in","inputType":[{"isList":true,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"notIn","inputType":[{"isList":true,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"lt","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"lte","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"gt","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"gte","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"contains","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"startsWith","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"endsWith","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]}],"atLeastOne":true},{"name":"PostFilter","fields":[{"name":"every","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"PostWhereInput"}]},{"name":"some","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"PostWhereInput"}]},{"name":"none","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"PostWhereInput"}]}],"atLeastOne":true},{"name":"StringFilter","fields":[{"name":"equals","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"not","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"},{"isList":false,"isRequired":false,"kind":"scalar","type":"StringFilter"}]},{"name":"in","inputType":[{"isList":true,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"notIn","inputType":[{"isList":true,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"lt","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"lte","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"gt","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"gte","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"contains","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"startsWith","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]},{"name":"endsWith","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"String"}]}],"atLeastOne":true},{"name":"AuthorFilter","fields":[{"name":"every","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"AuthorWhereInput"}]},{"name":"some","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"AuthorWhereInput"}]},{"name":"none","inputType":[{"isList":false,"isRequired":false,"kind":"scalar","type":"AuthorWhereInput"}]}],"atLeastOne":true},{"name":"BlogOrderByInput","atLeastOne":true,"atMostOne":true,"isOrderType":true,"fields":[{"name":"id","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false},{"name":"name","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false},{"name":"viewCount","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false}]},{"name":"AuthorOrderByInput","atLeastOne":true,"atMostOne":true,"isOrderType":true,"fields":[{"name":"id","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false},{"name":"name","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false}]},{"name":"PostOrderByInput","atLeastOne":true,"atMostOne":true,"isOrderType":true,"fields":[{"name":"id","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false},{"name":"title","inputType":[{"type":"OrderByArg","isList":false,"isRequired":false,"kind":"scalar"}],"isRelationFilter":false}]}]}}
    