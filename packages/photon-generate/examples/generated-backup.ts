import { DMMF } from '../src/runtime/dmmf-types'
import fetch from 'node-fetch'
import { DMMFClass } from '../src/runtime/dmmf'
import { deepGet } from '../src/runtime/utils/deep-set'
import { makeDocument } from '../src/runtime/query'
import { Subset } from './generated'

/**
 * Utility Types
 */

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

/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export type Subset<T, U> = { [key in keyof T]: key extends keyof U ? T[key] : never }

class PrismaFetcher {
  constructor(private readonly url: string) {}
  request<T>(query: string, path: string[] = []): Promise<T> {
    console.log(query)
    console.log(path)
    return Promise.resolve({ data: { som: 'thing' } } as any)
    // return fetch(this.url, {
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ query }),
    //   // TODO: More error handling
    // }).then(res => res.json()).then(res => path.length > 0 ? deepGet(res.data, path) : res.data)
  }
}

/**
 * Client
 **/

// could be a class if we want to require new Prisma(...)
// export default function Prisma() {
//   return new PrismaClient(null as any)
// }

export class Prisma {
  private fetcher?: PrismaFetcher
  private readonly dmmf: DMMFClass
  constructor() {
    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PrismaFetcher('http://localhost:8000')
  }
  async connect() {
    // TODO: Spawn Rust
  }
  async close() {
    // TODO: Kill Rust
  }
  private _query?: QueryDelegate
  get query() {
    return this._query ? this._query : (this._query = QueryDelegate(this.dmmf, this.fetcher))
  }
  private _users?: UserDelegate
  get users() {
    return this._users ? this._users : (this._users = UserDelegate(this.dmmf, this.fetcher))
  }
  private _profiles?: ProfileDelegate
  get profiles() {
    return this._profiles ? this._profiles : (this._profiles = ProfileDelegate(this.dmmf, this.fetcher))
  }
  private _posts?: PostDelegate
  get posts() {
    return this._posts ? this._posts : (this._posts = PostDelegate(this.dmmf, this.fetcher))
  }
}

/**
 * Query
 */

export type QueryArgs = {
  user?: FindOneUserArgs
  users?: FindManyUserArgs
  profile?: FindOneProfileArgs
  profiles?: FindManyProfileArgs
  post?: FindOnePostArgs
  posts?: FindManyPostArgs
}

type QueryGetPayload<S extends QueryArgs> = S extends QueryArgs
  ? {
      [P in keyof S]: P extends 'post'
        ? PostGetPayload<ExtractFindOnePostArgsSelect<S[P]>>
        : P extends 'posts'
        ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>>
        : P extends 'profile'
        ? ProfileGetPayload<ExtractFindOneProfileArgsSelect<S[P]>>
        : P extends 'profiles'
        ? Array<ProfileGetPayload<ExtractFindManyProfileArgsSelect<S[P]>>>
        : P extends 'user'
        ? UserGetPayload<ExtractFindOneUserArgsSelect<S[P]>>
        : P extends 'users'
        ? Array<UserGetPayload<ExtractFindManyUserArgsSelect<S[P]>>>
        : never
    }
  : never

interface QueryDelegate {
  <T extends QueryArgs>(args: Subset<T, QueryArgs>): PromiseLike<QueryGetPayload<T>>
}
function QueryDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): QueryDelegate {
  const Query = <T extends QueryArgs>(args: QueryArgs) => new QueryClient<T>(dmmf, fetcher, args, [])
  return Query
}

class QueryClient<T extends QueryArgs, U = QueryGetPayload<T>> implements PromiseLike<U> {
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
    // console.dir(document, {depth: 8})
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
    return this.fetcher.request<U>(this.query, this.path).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<U | TResult> {
    return this.fetcher.request<U>(this.query, this.path).catch(onrejected)
  }
}

/**
 * Model User
 */

export type User = {
  id: string
  name: string
  strings?: string[]
}

export type UserScalars = 'id' | 'name' | 'strings'

export type UserSelect = {
  id?: boolean
  name?: boolean
  strings?: boolean
  posts?: boolean | FindManyPostArgs
}

type UserDefault = {
  id: true
  name: true
  strings: true
}

type UserGetPayload<S extends boolean | UserSelect> = S extends true
  ? User
  : S extends UserSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<UserDefault, S>>]: P extends UserScalars
        ? User[P]
        : P extends 'posts'
        ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>>
        : never
    }
  : never

export interface UserDelegate {
  <T extends UserArgs>(args: Subset<T, UserArgs>): 'select' extends keyof T
    ? PromiseLike<Array<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>>
    : UserDelegate
  findOne<T extends FindOneUserArgs>(
    args: Subset<T, FindOneUserArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
  findMany<T extends FindManyUserArgs>(
    args: Subset<T, FindManyUserArgs>,
  ): PromiseLike<Array<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>>
  create<T extends UserCreateArgs>(
    args: Subset<T, UserCreateArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
  update<T extends UserUpdateArgs>(
    args: Subset<T, UserUpdateArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
  updateMany<T extends UserUpdateManyArgs>(
    args: Subset<T, UserUpdateManyArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
  upsert<T extends UserUpsertArgs>(
    args: Subset<T, UserUpsertArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
  delete<T extends UserDeleteArgs>(
    args: Subset<T, UserDeleteArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
  deleteMany<T extends UserDeleteManyArgs>(
    args: Subset<T, UserDeleteManyArgs>,
  ): PromiseLike<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>
}
function UserDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): UserDelegate {
  const User = <T extends UserArgs>(args: Subset<T, UserArgs>) =>
    args.select
      ? new UserClient<Array<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>>(
          dmmf,
          fetcher,
          'query',
          'users',
          args,
          [],
        )
      : this
  User.findOne = <T extends FindOneUserArgs>(args: Subset<T, FindOneUserArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(dmmf, fetcher, 'query', 'user', args, [])
  User.findMany = <T extends FindManyUserArgs>(args: Subset<T, FindManyUserArgs>) =>
    new UserClient<Array<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>>(dmmf, fetcher, 'query', 'users', args, [])
  User.create = <T extends UserCreateArgs>(args: Subset<T, UserCreateArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'createUser', args, [])
  User.update = <T extends UserUpdateArgs>(args: Subset<T, UserUpdateArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'updateUser', args, [])
  User.updateMany = <T extends UserUpdateManyArgs>(args: Subset<T, UserUpdateManyArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'updateManyUsers',
      args,
      [],
    )
  User.upsert = <T extends UserUpsertArgs>(args: Subset<T, UserUpsertArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'upsertUser', args, [])
  User.delete = <T extends UserDeleteArgs>(args: Subset<T, UserDeleteArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'deleteUser', args, [])
  User.deleteMany = <T extends UserDeleteManyArgs>(args: Subset<T, UserDeleteManyArgs>) =>
    new UserClient<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'deleteManyUsers',
      args,
      [],
    )
  return User
}

class UserClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly args: UserArgs,
    private readonly path: [],
  ) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args,
    })
    // console.dir(document, {depth: 8})
    document.validate(this.args, true)
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

// InputTypes

export type FindOneUserArgs = {
  select?: UserSelect
  where: UserWhereUniqueInput
}

export type FindOneUserArgsWithSelect = {
  select: UserSelect
  where: UserWhereUniqueInput
}

type ExtractFindOneUserArgsSelect<S extends boolean | FindOneUserArgs> = S extends boolean
  ? S
  : S extends FindOneUserArgsWithSelect
  ? S['select']
  : true

export type FindManyUserArgs = {
  select?: UserSelect
  where?: UserWhereInput
  orderBy?: UserOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyUserArgsWithSelect = {
  select: UserSelect
  where?: UserWhereInput
  orderBy?: UserOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyUserArgsSelect<S extends boolean | FindManyUserArgs> = S extends boolean
  ? S
  : S extends FindManyUserArgsWithSelect
  ? S['select']
  : true

export type UserCreateArgs = {
  select?: UserSelect
  data: UserCreateInput
}

export type UserCreateArgsWithSelect = {
  select: UserSelect
  data: UserCreateInput
}

type ExtractUserCreateArgsSelect<S extends boolean | UserCreateArgs> = S extends boolean
  ? S
  : S extends UserCreateArgsWithSelect
  ? S['select']
  : true

export type UserUpdateArgs = {
  select?: UserSelect
  data: UserUpdateInput
  where: UserWhereUniqueInput
}

export type UserUpdateArgsWithSelect = {
  select: UserSelect
  data: UserUpdateInput
  where: UserWhereUniqueInput
}

type ExtractUserUpdateArgsSelect<S extends boolean | UserUpdateArgs> = S extends boolean
  ? S
  : S extends UserUpdateArgsWithSelect
  ? S['select']
  : true

export type UserUpdateManyArgs = {
  select?: UserSelect
  data: UserUpdateManyMutationInput
  where?: UserWhereInput
}

export type UserUpdateManyArgsWithSelect = {
  select: UserSelect
  data: UserUpdateManyMutationInput
  where?: UserWhereInput
}

type ExtractUserUpdateManyArgsSelect<S extends boolean | UserUpdateManyArgs> = S extends boolean
  ? S
  : S extends UserUpdateManyArgsWithSelect
  ? S['select']
  : true

export type UserUpsertArgs = {
  select?: UserSelect
  where: UserWhereUniqueInput
  create: UserCreateInput
  update: UserUpdateInput
}

export type UserUpsertArgsWithSelect = {
  select: UserSelect
  where: UserWhereUniqueInput
  create: UserCreateInput
  update: UserUpdateInput
}

type ExtractUserUpsertArgsSelect<S extends boolean | UserUpsertArgs> = S extends boolean
  ? S
  : S extends UserUpsertArgsWithSelect
  ? S['select']
  : true

export type UserDeleteArgs = {
  select?: UserSelect
  where: UserWhereUniqueInput
}

export type UserDeleteArgsWithSelect = {
  select: UserSelect
  where: UserWhereUniqueInput
}

type ExtractUserDeleteArgsSelect<S extends boolean | UserDeleteArgs> = S extends boolean
  ? S
  : S extends UserDeleteArgsWithSelect
  ? S['select']
  : true

export type UserDeleteManyArgs = {
  select?: UserSelect
  where?: UserWhereInput
}

export type UserDeleteManyArgsWithSelect = {
  select: UserSelect
  where?: UserWhereInput
}

type ExtractUserDeleteManyArgsSelect<S extends boolean | UserDeleteManyArgs> = S extends boolean
  ? S
  : S extends UserDeleteManyArgsWithSelect
  ? S['select']
  : true

export type UserArgs = {
  select?: UserSelect
}

export type UserArgsWithSelect = {
  select: UserSelect
}

type ExtractUserArgsSelect<S extends boolean | UserArgs> = S extends boolean
  ? S
  : S extends UserArgsWithSelect
  ? S['select']
  : true

/**
 * Model Profile
 */

export type Profile = {
  id: string
  url: string
}

export type ProfileScalars = 'id' | 'url'

export type ProfileSelect = {
  id?: boolean
  url?: boolean
}

type ProfileDefault = {
  id: true
  url: true
}

type ProfileGetPayload<S extends boolean | ProfileSelect> = S extends true
  ? Profile
  : S extends ProfileSelect
  ? { [P in CleanupNever<MergeTruthyValues<ProfileDefault, S>>]: P extends ProfileScalars ? Profile[P] : never }
  : never

export interface ProfileDelegate {
  <T extends ProfileArgs>(args: Subset<T, ProfileArgs>): PromiseLike<
    Array<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  >
  findOne<T extends FindOneProfileArgs>(
    args: Subset<T, FindOneProfileArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  findMany<T extends FindManyProfileArgs>(
    args: Subset<T, FindManyProfileArgs>,
  ): PromiseLike<Array<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>>
  create<T extends ProfileCreateArgs>(
    args: Subset<T, ProfileCreateArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  update<T extends ProfileUpdateArgs>(
    args: Subset<T, ProfileUpdateArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  updateMany<T extends ProfileUpdateManyArgs>(
    args: Subset<T, ProfileUpdateManyArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  upsert<T extends ProfileUpsertArgs>(
    args: Subset<T, ProfileUpsertArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  delete<T extends ProfileDeleteArgs>(
    args: Subset<T, ProfileDeleteArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
  deleteMany<T extends ProfileDeleteManyArgs>(
    args: Subset<T, ProfileDeleteManyArgs>,
  ): PromiseLike<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>
}
function ProfileDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): ProfileDelegate {
  const Profile = <T extends ProfileArgs>(args: Subset<T, ProfileArgs>) =>
    new ProfileClient<Array<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>>(
      dmmf,
      fetcher,
      'query',
      'profiles',
      args,
      [],
    )
  Profile.findOne = <T extends FindOneProfileArgs>(args: Subset<T, FindOneProfileArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'query',
      'profile',
      args,
      [],
    )
  Profile.findMany = <T extends FindManyProfileArgs>(args: Subset<T, FindManyProfileArgs>) =>
    new ProfileClient<Array<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>>(
      dmmf,
      fetcher,
      'query',
      'profiles',
      args,
      [],
    )
  Profile.create = <T extends ProfileCreateArgs>(args: Subset<T, ProfileCreateArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'createProfile',
      args,
      [],
    )
  Profile.update = <T extends ProfileUpdateArgs>(args: Subset<T, ProfileUpdateArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'updateProfile',
      args,
      [],
    )
  Profile.updateMany = <T extends ProfileUpdateManyArgs>(args: Subset<T, ProfileUpdateManyArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'updateManyProfiles',
      args,
      [],
    )
  Profile.upsert = <T extends ProfileUpsertArgs>(args: Subset<T, ProfileUpsertArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'upsertProfile',
      args,
      [],
    )
  Profile.delete = <T extends ProfileDeleteArgs>(args: Subset<T, ProfileDeleteArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'deleteProfile',
      args,
      [],
    )
  Profile.deleteMany = <T extends ProfileDeleteManyArgs>(args: Subset<T, ProfileDeleteManyArgs>) =>
    new ProfileClient<ProfileGetPayload<ExtractFindManyProfileArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'deleteManyProfiles',
      args,
      [],
    )
  return Profile
}

class ProfileClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly args: ProfileArgs,
    private readonly path: [],
  ) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args,
    })
    // console.dir(document, {depth: 8})
    document.validate(this.args, true)
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

// InputTypes

export type FindOneProfileArgs = {
  select?: ProfileSelect
  where: ProfileWhereUniqueInput
}

export type FindOneProfileArgsWithSelect = {
  select: ProfileSelect
  where: ProfileWhereUniqueInput
}

type ExtractFindOneProfileArgsSelect<S extends boolean | FindOneProfileArgs> = S extends boolean
  ? S
  : S extends FindOneProfileArgsWithSelect
  ? S['select']
  : true

export type FindManyProfileArgs = {
  select?: ProfileSelect
  where?: ProfileWhereInput
  orderBy?: ProfileOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyProfileArgsWithSelect = {
  select: ProfileSelect
  where?: ProfileWhereInput
  orderBy?: ProfileOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyProfileArgsSelect<S extends boolean | FindManyProfileArgs> = S extends boolean
  ? S
  : S extends FindManyProfileArgsWithSelect
  ? S['select']
  : true

export type ProfileCreateArgs = {
  select?: ProfileSelect
  data: ProfileCreateInput
}

export type ProfileCreateArgsWithSelect = {
  select: ProfileSelect
  data: ProfileCreateInput
}

type ExtractProfileCreateArgsSelect<S extends boolean | ProfileCreateArgs> = S extends boolean
  ? S
  : S extends ProfileCreateArgsWithSelect
  ? S['select']
  : true

export type ProfileUpdateArgs = {
  select?: ProfileSelect
  data: ProfileUpdateInput
  where: ProfileWhereUniqueInput
}

export type ProfileUpdateArgsWithSelect = {
  select: ProfileSelect
  data: ProfileUpdateInput
  where: ProfileWhereUniqueInput
}

type ExtractProfileUpdateArgsSelect<S extends boolean | ProfileUpdateArgs> = S extends boolean
  ? S
  : S extends ProfileUpdateArgsWithSelect
  ? S['select']
  : true

export type ProfileUpdateManyArgs = {
  select?: ProfileSelect
  data: ProfileUpdateManyMutationInput
  where?: ProfileWhereInput
}

export type ProfileUpdateManyArgsWithSelect = {
  select: ProfileSelect
  data: ProfileUpdateManyMutationInput
  where?: ProfileWhereInput
}

type ExtractProfileUpdateManyArgsSelect<S extends boolean | ProfileUpdateManyArgs> = S extends boolean
  ? S
  : S extends ProfileUpdateManyArgsWithSelect
  ? S['select']
  : true

export type ProfileUpsertArgs = {
  select?: ProfileSelect
  where: ProfileWhereUniqueInput
  create: ProfileCreateInput
  update: ProfileUpdateInput
}

export type ProfileUpsertArgsWithSelect = {
  select: ProfileSelect
  where: ProfileWhereUniqueInput
  create: ProfileCreateInput
  update: ProfileUpdateInput
}

type ExtractProfileUpsertArgsSelect<S extends boolean | ProfileUpsertArgs> = S extends boolean
  ? S
  : S extends ProfileUpsertArgsWithSelect
  ? S['select']
  : true

export type ProfileDeleteArgs = {
  select?: ProfileSelect
  where: ProfileWhereUniqueInput
}

export type ProfileDeleteArgsWithSelect = {
  select: ProfileSelect
  where: ProfileWhereUniqueInput
}

type ExtractProfileDeleteArgsSelect<S extends boolean | ProfileDeleteArgs> = S extends boolean
  ? S
  : S extends ProfileDeleteArgsWithSelect
  ? S['select']
  : true

export type ProfileDeleteManyArgs = {
  select?: ProfileSelect
  where?: ProfileWhereInput
}

export type ProfileDeleteManyArgsWithSelect = {
  select: ProfileSelect
  where?: ProfileWhereInput
}

type ExtractProfileDeleteManyArgsSelect<S extends boolean | ProfileDeleteManyArgs> = S extends boolean
  ? S
  : S extends ProfileDeleteManyArgsWithSelect
  ? S['select']
  : true

export type ProfileArgs = {
  select?: ProfileSelect
}

export type ProfileArgsWithSelect = {
  select: ProfileSelect
}

type ExtractProfileArgsSelect<S extends boolean | ProfileArgs> = S extends boolean
  ? S
  : S extends ProfileArgsWithSelect
  ? S['select']
  : true

/**
 * Model Post
 */

export type Post = {
  id: string
  title: string
  content: string
}

export type PostScalars = 'id' | 'title' | 'content'

export type PostSelect = {
  id?: boolean
  title?: boolean
  content?: boolean
  author?: boolean | UserArgs
}

type PostDefault = {
  id: true
  title: true
  content: true
}

type PostGetPayload<S extends boolean | PostSelect> = S extends true
  ? Post
  : S extends PostSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<PostDefault, S>>]: P extends PostScalars
        ? Post[P]
        : P extends 'author'
        ? UserGetPayload<ExtractUserArgsSelect<S[P]>>
        : never
    }
  : never

export interface PostDelegate {
  <T extends PostArgs>(args: Subset<T, PostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>
  findOne<T extends FindOnePostArgs>(
    args: Subset<T, FindOnePostArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
  findMany<T extends FindManyPostArgs>(
    args: Subset<T, FindManyPostArgs>,
  ): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>
  create<T extends PostCreateArgs>(
    args: Subset<T, PostCreateArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
  update<T extends PostUpdateArgs>(
    args: Subset<T, PostUpdateArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
  updateMany<T extends PostUpdateManyArgs>(
    args: Subset<T, PostUpdateManyArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
  upsert<T extends PostUpsertArgs>(
    args: Subset<T, PostUpsertArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
  delete<T extends PostDeleteArgs>(
    args: Subset<T, PostDeleteArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
  deleteMany<T extends PostDeleteManyArgs>(
    args: Subset<T, PostDeleteManyArgs>,
  ): PromiseLike<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>
}
function PostDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): PostDelegate {
  const Post = <T extends PostArgs>(args: Subset<T, PostArgs>) =>
    new PostClient<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>(dmmf, fetcher, 'query', 'posts', args, [])
  Post.findOne = <T extends FindOnePostArgs>(args: Subset<T, FindOnePostArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(dmmf, fetcher, 'query', 'post', args, [])
  Post.findMany = <T extends FindManyPostArgs>(args: Subset<T, FindManyPostArgs>) =>
    new PostClient<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>(dmmf, fetcher, 'query', 'posts', args, [])
  Post.create = <T extends PostCreateArgs>(args: Subset<T, PostCreateArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'createPost', args, [])
  Post.update = <T extends PostUpdateArgs>(args: Subset<T, PostUpdateArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'updatePost', args, [])
  Post.updateMany = <T extends PostUpdateManyArgs>(args: Subset<T, PostUpdateManyArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'updateManyPosts',
      args,
      [],
    )
  Post.upsert = <T extends PostUpsertArgs>(args: Subset<T, PostUpsertArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'upsertPost', args, [])
  Post.delete = <T extends PostDeleteArgs>(args: Subset<T, PostDeleteArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(dmmf, fetcher, 'mutation', 'deletePost', args, [])
  Post.deleteMany = <T extends PostDeleteManyArgs>(args: Subset<T, PostDeleteManyArgs>) =>
    new PostClient<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>(
      dmmf,
      fetcher,
      'mutation',
      'deleteManyPosts',
      args,
      [],
    )
  return Post
}

class PostClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly args: PostArgs,
    private readonly path: [],
  ) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args,
    })
    // console.dir(document, {depth: 8})
    document.validate(this.args, true)
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

// InputTypes

export type FindOnePostArgs = {
  select?: PostSelect
  where: PostWhereUniqueInput
}

export type FindOnePostArgsWithSelect = {
  select: PostSelect
  where: PostWhereUniqueInput
}

type ExtractFindOnePostArgsSelect<S extends boolean | FindOnePostArgs> = S extends boolean
  ? S
  : S extends FindOnePostArgsWithSelect
  ? S['select']
  : true

export type FindManyPostArgs = {
  select?: PostSelect
  where?: PostWhereInput
  orderBy?: PostOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyPostArgsWithSelect = {
  select: PostSelect
  where?: PostWhereInput
  orderBy?: PostOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyPostArgsSelect<S extends boolean | FindManyPostArgs> = S extends boolean
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

type ExtractPostCreateArgsSelect<S extends boolean | PostCreateArgs> = S extends boolean
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

type ExtractPostUpdateArgsSelect<S extends boolean | PostUpdateArgs> = S extends boolean
  ? S
  : S extends PostUpdateArgsWithSelect
  ? S['select']
  : true

export type PostUpdateManyArgs = {
  select?: PostSelect
  data: PostUpdateManyMutationInput
  where?: PostWhereInput
}

export type PostUpdateManyArgsWithSelect = {
  select: PostSelect
  data: PostUpdateManyMutationInput
  where?: PostWhereInput
}

type ExtractPostUpdateManyArgsSelect<S extends boolean | PostUpdateManyArgs> = S extends boolean
  ? S
  : S extends PostUpdateManyArgsWithSelect
  ? S['select']
  : true

export type PostUpsertArgs = {
  select?: PostSelect
  where: PostWhereUniqueInput
  create: PostCreateInput
  update: PostUpdateInput
}

export type PostUpsertArgsWithSelect = {
  select: PostSelect
  where: PostWhereUniqueInput
  create: PostCreateInput
  update: PostUpdateInput
}

type ExtractPostUpsertArgsSelect<S extends boolean | PostUpsertArgs> = S extends boolean
  ? S
  : S extends PostUpsertArgsWithSelect
  ? S['select']
  : true

export type PostDeleteArgs = {
  select?: PostSelect
  where: PostWhereUniqueInput
}

export type PostDeleteArgsWithSelect = {
  select: PostSelect
  where: PostWhereUniqueInput
}

type ExtractPostDeleteArgsSelect<S extends boolean | PostDeleteArgs> = S extends boolean
  ? S
  : S extends PostDeleteArgsWithSelect
  ? S['select']
  : true

export type PostDeleteManyArgs = {
  select?: PostSelect
  where?: PostWhereInput
}

export type PostDeleteManyArgsWithSelect = {
  select: PostSelect
  where?: PostWhereInput
}

type ExtractPostDeleteManyArgsSelect<S extends boolean | PostDeleteManyArgs> = S extends boolean
  ? S
  : S extends PostDeleteManyArgsWithSelect
  ? S['select']
  : true

export type PostArgs = {
  select?: PostSelect
}

export type PostArgsWithSelect = {
  select: PostSelect
}

type ExtractPostArgsSelect<S extends boolean | PostArgs> = S extends boolean
  ? S
  : S extends PostArgsWithSelect
  ? S['select']
  : true

/**
 * Deep Input Types
 */

export type PostWhereUniqueInput = {
  id?: string
}

export type PostWhereInput = {
  id?: string
  id_not?: string
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string
  id_lte?: string
  id_gt?: string
  id_gte?: string
  id_contains?: string
  id_not_contains?: string
  id_starts_with?: string
  id_not_starts_with?: string
  id_ends_with?: string
  id_not_ends_with?: string
  title?: string
  title_not?: string
  title_in?: string[]
  title_not_in?: string[]
  title_lt?: string
  title_lte?: string
  title_gt?: string
  title_gte?: string
  title_contains?: string
  title_not_contains?: string
  title_starts_with?: string
  title_not_starts_with?: string
  title_ends_with?: string
  title_not_ends_with?: string
  content?: string
  content_not?: string
  content_in?: string[]
  content_not_in?: string[]
  content_lt?: string
  content_lte?: string
  content_gt?: string
  content_gte?: string
  content_contains?: string
  content_not_contains?: string
  content_starts_with?: string
  content_not_starts_with?: string
  content_ends_with?: string
  content_not_ends_with?: string
  author?: UserWhereInput
  AND?: PostWhereInput[]
  OR?: PostWhereInput[]
  NOT?: PostWhereInput[]
}

export type UserWhereInput = {
  id?: string
  id_not?: string
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string
  id_lte?: string
  id_gt?: string
  id_gte?: string
  id_contains?: string
  id_not_contains?: string
  id_starts_with?: string
  id_not_starts_with?: string
  id_ends_with?: string
  id_not_ends_with?: string
  name?: string
  name_not?: string
  name_in?: string[]
  name_not_in?: string[]
  name_lt?: string
  name_lte?: string
  name_gt?: string
  name_gte?: string
  name_contains?: string
  name_not_contains?: string
  name_starts_with?: string
  name_not_starts_with?: string
  name_ends_with?: string
  name_not_ends_with?: string
  posts_every?: PostWhereInput
  posts_some?: PostWhereInput
  posts_none?: PostWhereInput
  AND?: UserWhereInput[]
  OR?: UserWhereInput[]
  NOT?: UserWhereInput[]
}

export type PostOrderByInput = {
  id_ASC?: PostOrderByInput
  id_DESC?: PostOrderByInput
  title_ASC?: PostOrderByInput
  title_DESC?: PostOrderByInput
  content_ASC?: PostOrderByInput
  content_DESC?: PostOrderByInput
}

export type ProfileWhereUniqueInput = {
  id?: string
}

export type ProfileWhereInput = {
  id?: string
  id_not?: string
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string
  id_lte?: string
  id_gt?: string
  id_gte?: string
  id_contains?: string
  id_not_contains?: string
  id_starts_with?: string
  id_not_starts_with?: string
  id_ends_with?: string
  id_not_ends_with?: string
  url?: string
  url_not?: string
  url_in?: string[]
  url_not_in?: string[]
  url_lt?: string
  url_lte?: string
  url_gt?: string
  url_gte?: string
  url_contains?: string
  url_not_contains?: string
  url_starts_with?: string
  url_not_starts_with?: string
  url_ends_with?: string
  url_not_ends_with?: string
  AND?: ProfileWhereInput[]
  OR?: ProfileWhereInput[]
  NOT?: ProfileWhereInput[]
}

export type ProfileOrderByInput = {
  id_ASC?: ProfileOrderByInput
  id_DESC?: ProfileOrderByInput
  url_ASC?: ProfileOrderByInput
  url_DESC?: ProfileOrderByInput
}

export type UserWhereUniqueInput = {
  id?: string
}

export type UserOrderByInput = {
  id_ASC?: UserOrderByInput
  id_DESC?: UserOrderByInput
  name_ASC?: UserOrderByInput
  name_DESC?: UserOrderByInput
}

export type PostCreateInput = {
  id?: string
  title: string
  content: string
  author: UserCreateOneWithoutPostsInput
}

export type UserCreateOneWithoutPostsInput = {
  create?: UserCreateWithoutPostsInput
  connect?: UserWhereUniqueInput
}

export type UserCreateWithoutPostsInput = {
  id?: string
  name: string
  strings?: UserCreatestringsInput
}

export type UserCreatestringsInput = {
  set?: string[]
}

export type PostUpdateInput = {
  title?: string
  content?: string
  author?: UserUpdateOneRequiredWithoutPostsInput
}

export type UserUpdateOneRequiredWithoutPostsInput = {
  create?: UserCreateWithoutPostsInput
  update?: UserUpdateWithoutPostsDataInput
  upsert?: UserUpsertWithoutPostsInput
  connect?: UserWhereUniqueInput
}

export type UserUpdateWithoutPostsDataInput = {
  name?: string
  strings?: UserUpdatestringsInput
}

export type UserUpdatestringsInput = {
  set?: string[]
}

export type UserUpsertWithoutPostsInput = {
  update: UserUpdateWithoutPostsDataInput
  create: UserCreateWithoutPostsInput
}

export type PostUpdateManyMutationInput = {
  title?: string
  content?: string
}

export type ProfileCreateInput = {
  id?: string
  url: string
}

export type ProfileUpdateInput = {
  url?: string
}

export type ProfileUpdateManyMutationInput = {
  url?: string
}

export type UserCreateInput = {
  id?: string
  name: string
  strings?: UserCreatestringsInput
  posts?: PostCreateManyWithoutAuthorInput
}

export type PostCreateManyWithoutAuthorInput = {
  create?: PostCreateWithoutAuthorInput[]
  connect?: PostWhereUniqueInput[]
}

export type PostCreateWithoutAuthorInput = {
  id?: string
  title: string
  content: string
}

export type UserUpdateInput = {
  name?: string
  strings?: UserUpdatestringsInput
  posts?: PostUpdateManyWithoutAuthorInput
}

export type PostUpdateManyWithoutAuthorInput = {
  create?: PostCreateWithoutAuthorInput[]
  delete?: PostWhereUniqueInput[]
  connect?: PostWhereUniqueInput[]
  set?: PostWhereUniqueInput[]
  disconnect?: PostWhereUniqueInput[]
  update?: PostUpdateWithWhereUniqueWithoutAuthorInput[]
  upsert?: PostUpsertWithWhereUniqueWithoutAuthorInput[]
  deleteMany?: PostScalarWhereInput[]
  updateMany?: PostUpdateManyWithWhereNestedInput[]
}

export type PostUpdateWithWhereUniqueWithoutAuthorInput = {
  where: PostWhereUniqueInput
  data: PostUpdateWithoutAuthorDataInput
}

export type PostUpdateWithoutAuthorDataInput = {
  title?: string
  content?: string
}

export type PostUpsertWithWhereUniqueWithoutAuthorInput = {
  where: PostWhereUniqueInput
  update: PostUpdateWithoutAuthorDataInput
  create: PostCreateWithoutAuthorInput
}

export type PostScalarWhereInput = {
  id?: string
  id_not?: string
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string
  id_lte?: string
  id_gt?: string
  id_gte?: string
  id_contains?: string
  id_not_contains?: string
  id_starts_with?: string
  id_not_starts_with?: string
  id_ends_with?: string
  id_not_ends_with?: string
  title?: string
  title_not?: string
  title_in?: string[]
  title_not_in?: string[]
  title_lt?: string
  title_lte?: string
  title_gt?: string
  title_gte?: string
  title_contains?: string
  title_not_contains?: string
  title_starts_with?: string
  title_not_starts_with?: string
  title_ends_with?: string
  title_not_ends_with?: string
  content?: string
  content_not?: string
  content_in?: string[]
  content_not_in?: string[]
  content_lt?: string
  content_lte?: string
  content_gt?: string
  content_gte?: string
  content_contains?: string
  content_not_contains?: string
  content_starts_with?: string
  content_not_starts_with?: string
  content_ends_with?: string
  content_not_ends_with?: string
  AND?: PostScalarWhereInput[]
  OR?: PostScalarWhereInput[]
  NOT?: PostScalarWhereInput[]
}

export type PostUpdateManyWithWhereNestedInput = {
  where: PostScalarWhereInput
  data: PostUpdateManyDataInput
}

export type PostUpdateManyDataInput = {
  title?: string
  content?: string
}

export type UserUpdateManyMutationInput = {
  name?: string
  strings?: UserUpdatestringsInput
}

/**
 * DMMF
 */

const dmmf: DMMF.Document = {
  datamodel: {
    models: [
      {
        name: 'User',
        isEmbedded: false,
        isEnum: false,
        dbName: '',
        fields: [
          {
            kind: 'scalar',
            name: 'id',
            isUnique: true,
            isId: true,
            type: 'ID',
            isList: false,
            isRequired: true,
          },
          {
            kind: 'scalar',
            name: 'name',
            isUnique: false,
            isId: false,
            type: 'String',
            isList: false,
            isRequired: true,
          },
          {
            kind: 'scalar',
            name: 'strings',
            isUnique: false,
            isId: false,
            type: 'String',
            isList: true,
            isRequired: false,
          },
          {
            kind: 'relation',
            name: 'posts',
            isUnique: false,
            isId: false,
            type: 'Post',
            isList: true,
            isRequired: false,
          },
        ],
      },
      {
        name: 'Profile',
        isEmbedded: false,
        isEnum: false,
        dbName: '',
        fields: [
          {
            kind: 'scalar',
            name: 'id',
            isUnique: true,
            isId: true,
            type: 'ID',
            isList: false,
            isRequired: true,
          },
          {
            kind: 'scalar',
            name: 'url',
            isUnique: false,
            isId: false,
            type: 'String',
            isList: false,
            isRequired: true,
          },
        ],
      },
      {
        name: 'Post',
        isEmbedded: false,
        isEnum: false,
        dbName: '',
        fields: [
          {
            kind: 'scalar',
            name: 'id',
            isUnique: true,
            isId: true,
            type: 'ID',
            isList: false,
            isRequired: true,
          },
          {
            kind: 'scalar',
            name: 'title',
            isUnique: false,
            isId: false,
            type: 'String',
            isList: false,
            isRequired: true,
          },
          {
            kind: 'scalar',
            name: 'content',
            isUnique: false,
            isId: false,
            type: 'String',
            isList: false,
            isRequired: true,
          },
          {
            kind: 'relation',
            name: 'author',
            isUnique: false,
            isId: false,
            type: 'User',
            isList: false,
            isRequired: true,
          },
        ],
      },
    ],
  },
  schema: {
    queries: [
      {
        name: 'post',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Post',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'posts',
        args: [
          {
            name: 'where',
            type: 'PostWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'orderBy',
            type: 'PostOrderByInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'skip',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'after',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'before',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'first',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'last',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'Post',
          isList: true,
          isRequired: true,
        },
      },
      {
        name: 'postsConnection',
        args: [
          {
            name: 'where',
            type: 'PostWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'orderBy',
            type: 'PostOrderByInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'skip',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'after',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'before',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'first',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'last',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'PostConnection',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'profile',
        args: [
          {
            name: 'where',
            type: 'ProfileWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Profile',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'profiles',
        args: [
          {
            name: 'where',
            type: 'ProfileWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'orderBy',
            type: 'ProfileOrderByInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'skip',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'after',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'before',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'first',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'last',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'Profile',
          isList: true,
          isRequired: true,
        },
      },
      {
        name: 'profilesConnection',
        args: [
          {
            name: 'where',
            type: 'ProfileWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'orderBy',
            type: 'ProfileOrderByInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'skip',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'after',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'before',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'first',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'last',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'ProfileConnection',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'user',
        args: [
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'User',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'users',
        args: [
          {
            name: 'where',
            type: 'UserWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'orderBy',
            type: 'UserOrderByInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'skip',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'after',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'before',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'first',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'last',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'User',
          isList: true,
          isRequired: true,
        },
      },
      {
        name: 'usersConnection',
        args: [
          {
            name: 'where',
            type: 'UserWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'orderBy',
            type: 'UserOrderByInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
          {
            name: 'skip',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'after',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'before',
            type: 'String',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'first',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
          {
            name: 'last',
            type: 'Int',
            isRequired: false,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'UserConnection',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'node',
        args: [
          {
            name: 'id',
            type: 'ID',
            isRequired: true,
            isScalar: true,
            isList: false,
          },
        ],
        output: {
          name: 'Node',
          isList: false,
          isRequired: false,
        },
      },
    ],
    mutations: [
      {
        name: 'createPost',
        args: [
          {
            name: 'data',
            type: 'PostCreateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Post',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'updatePost',
        args: [
          {
            name: 'data',
            type: 'PostUpdateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Post',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'updateManyPosts',
        args: [
          {
            name: 'data',
            type: 'PostUpdateManyMutationInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'where',
            type: 'PostWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'BatchPayload',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'upsertPost',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'create',
            type: 'PostCreateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'update',
            type: 'PostUpdateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Post',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'deletePost',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Post',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'deleteManyPosts',
        args: [
          {
            name: 'where',
            type: 'PostWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'BatchPayload',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'createProfile',
        args: [
          {
            name: 'data',
            type: 'ProfileCreateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Profile',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'updateProfile',
        args: [
          {
            name: 'data',
            type: 'ProfileUpdateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'where',
            type: 'ProfileWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Profile',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'updateManyProfiles',
        args: [
          {
            name: 'data',
            type: 'ProfileUpdateManyMutationInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'where',
            type: 'ProfileWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'BatchPayload',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'upsertProfile',
        args: [
          {
            name: 'where',
            type: 'ProfileWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'create',
            type: 'ProfileCreateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'update',
            type: 'ProfileUpdateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Profile',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'deleteProfile',
        args: [
          {
            name: 'where',
            type: 'ProfileWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'Profile',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'deleteManyProfiles',
        args: [
          {
            name: 'where',
            type: 'ProfileWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'BatchPayload',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'createUser',
        args: [
          {
            name: 'data',
            type: 'UserCreateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'User',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'updateUser',
        args: [
          {
            name: 'data',
            type: 'UserUpdateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'User',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'updateManyUsers',
        args: [
          {
            name: 'data',
            type: 'UserUpdateManyMutationInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'where',
            type: 'UserWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'BatchPayload',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'upsertUser',
        args: [
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'create',
            type: 'UserCreateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
          {
            name: 'update',
            type: 'UserUpdateInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'User',
          isList: false,
          isRequired: true,
        },
      },
      {
        name: 'deleteUser',
        args: [
          {
            name: 'where',
            type: 'UserWhereUniqueInput',
            isRequired: true,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'User',
          isList: false,
          isRequired: false,
        },
      },
      {
        name: 'deleteManyUsers',
        args: [
          {
            name: 'where',
            type: 'UserWhereInput',
            isRequired: false,
            isScalar: false,
            isList: false,
          },
        ],
        output: {
          name: 'BatchPayload',
          isList: false,
          isRequired: true,
        },
      },
    ],
    inputTypes: [
      {
        name: 'PostWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'PostWhereInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_lt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_lte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_gt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_gte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_lt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_lte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_gt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_gte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'author',
            type: 'UserWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'AND',
            type: 'PostWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'PostWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'PostWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserWhereInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_not',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_not_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_lt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_lte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_gt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_gte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_not_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_not_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name_not_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'posts_every',
            type: 'PostWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'posts_some',
            type: 'PostWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'posts_none',
            type: 'PostWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'AND',
            type: 'UserWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'UserWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'UserWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'PostOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'id_DESC',
            type: 'PostOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'title_ASC',
            type: 'PostOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'title_DESC',
            type: 'PostOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'content_ASC',
            type: 'PostOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'content_DESC',
            type: 'PostOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'ProfileWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'ProfileWhereInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_not',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_not_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_lt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_lte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_gt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_gte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_not_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_not_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url_not_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'AND',
            type: 'ProfileWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'ProfileWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'ProfileWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'ProfileOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'ProfileOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'id_DESC',
            type: 'ProfileOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'url_ASC',
            type: 'ProfileOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'url_DESC',
            type: 'ProfileOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'UserWhereUniqueInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'UserOrderByInput',
        args: [
          {
            name: 'id_ASC',
            type: 'UserOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'id_DESC',
            type: 'UserOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'name_ASC',
            type: 'UserOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'name_DESC',
            type: 'UserOrderByInput',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'PostCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
          {
            name: 'author',
            type: 'UserCreateOneWithoutPostsInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserCreateOneWithoutPostsInput',
        args: [
          {
            name: 'create',
            type: 'UserCreateWithoutPostsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'connect',
            type: 'UserWhereUniqueInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserCreateWithoutPostsInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
          {
            name: 'strings',
            type: 'UserCreatestringsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserCreatestringsInput',
        args: [
          {
            name: 'set',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'PostUpdateInput',
        args: [
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'author',
            type: 'UserUpdateOneRequiredWithoutPostsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserUpdateOneRequiredWithoutPostsInput',
        args: [
          {
            name: 'create',
            type: 'UserCreateWithoutPostsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'update',
            type: 'UserUpdateWithoutPostsDataInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'upsert',
            type: 'UserUpsertWithoutPostsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'connect',
            type: 'UserWhereUniqueInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserUpdateWithoutPostsDataInput',
        args: [
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserUpdatestringsInput',
        args: [
          {
            name: 'set',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'UserUpsertWithoutPostsInput',
        args: [
          {
            name: 'update',
            type: 'UserUpdateWithoutPostsDataInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
          {
            name: 'create',
            type: 'UserCreateWithoutPostsInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostUpdateManyMutationInput',
        args: [
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'ProfileCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'url',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
        ],
      },
      {
        name: 'ProfileUpdateInput',
        args: [
          {
            name: 'url',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'ProfileUpdateManyMutationInput',
        args: [
          {
            name: 'url',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'UserCreateInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
          {
            name: 'strings',
            type: 'UserCreatestringsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'posts',
            type: 'PostCreateManyWithoutAuthorInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostCreateManyWithoutAuthorInput',
        args: [
          {
            name: 'create',
            type: 'PostCreateWithoutAuthorInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'connect',
            type: 'PostWhereUniqueInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostCreateWithoutAuthorInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: true,
            isScalar: true,
          },
        ],
      },
      {
        name: 'UserUpdateInput',
        args: [
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'posts',
            type: 'PostUpdateManyWithoutAuthorInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostUpdateManyWithoutAuthorInput',
        args: [
          {
            name: 'create',
            type: 'PostCreateWithoutAuthorInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'delete',
            type: 'PostWhereUniqueInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'connect',
            type: 'PostWhereUniqueInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'set',
            type: 'PostWhereUniqueInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'disconnect',
            type: 'PostWhereUniqueInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'update',
            type: 'PostUpdateWithWhereUniqueWithoutAuthorInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'upsert',
            type: 'PostUpsertWithWhereUniqueWithoutAuthorInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'deleteMany',
            type: 'PostScalarWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'updateMany',
            type: 'PostUpdateManyWithWhereNestedInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostUpdateWithWhereUniqueWithoutAuthorInput',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
          {
            name: 'data',
            type: 'PostUpdateWithoutAuthorDataInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostUpdateWithoutAuthorDataInput',
        args: [
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'PostUpsertWithWhereUniqueWithoutAuthorInput',
        args: [
          {
            name: 'where',
            type: 'PostWhereUniqueInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
          {
            name: 'update',
            type: 'PostUpdateWithoutAuthorDataInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
          {
            name: 'create',
            type: 'PostCreateWithoutAuthorInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostScalarWhereInput',
        args: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_in',
            type: 'ID',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_lte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gt',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_gte',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_contains',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_starts_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'id_not_ends_with',
            type: 'ID',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_lt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_lte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_gt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_gte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'title_not_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_in',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_lt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_lte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_gt',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_gte',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_starts_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content_not_ends_with',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'AND',
            type: 'PostScalarWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'PostScalarWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'PostScalarWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostUpdateManyWithWhereNestedInput',
        args: [
          {
            name: 'where',
            type: 'PostScalarWhereInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
          {
            name: 'data',
            type: 'PostUpdateManyDataInput',
            isList: false,
            isRequired: true,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostUpdateManyDataInput',
        args: [
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'UserUpdateManyMutationInput',
        args: [
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'strings',
            type: 'UserUpdatestringsInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'PostSubscriptionWhereInput',
        args: [
          {
            name: 'mutation_in',
            type: 'MutationType',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'updatedFields_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'updatedFields_contains_every',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'updatedFields_contains_some',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'node',
            type: 'PostWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'AND',
            type: 'PostSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'PostSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'PostSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'MutationType',
        args: [
          {
            name: 'CREATED',
            type: 'MutationType',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'UPDATED',
            type: 'MutationType',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
          {
            name: 'DELETED',
            type: 'MutationType',
            isRequired: false,
            isList: false,
            isScalar: true,
          },
        ],
      },
      {
        name: 'ProfileSubscriptionWhereInput',
        args: [
          {
            name: 'mutation_in',
            type: 'MutationType',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'updatedFields_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'updatedFields_contains_every',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'updatedFields_contains_some',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'node',
            type: 'ProfileWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'AND',
            type: 'ProfileSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'ProfileSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'ProfileSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
      {
        name: 'UserSubscriptionWhereInput',
        args: [
          {
            name: 'mutation_in',
            type: 'MutationType',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'updatedFields_contains',
            type: 'String',
            isList: false,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'updatedFields_contains_every',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'updatedFields_contains_some',
            type: 'String',
            isList: true,
            isRequired: false,
            isScalar: true,
          },
          {
            name: 'node',
            type: 'UserWhereInput',
            isList: false,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'AND',
            type: 'UserSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'OR',
            type: 'UserSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
          {
            name: 'NOT',
            type: 'UserSubscriptionWhereInput',
            isList: true,
            isRequired: false,
            isScalar: false,
          },
        ],
      },
    ],
    outputTypes: [
      {
        name: 'Query',
        fields: [
          {
            name: 'post',
            type: 'Post',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'PostWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'posts',
            type: 'Post',
            isList: true,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'PostWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'PostOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'postsConnection',
            type: 'PostConnection',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'PostWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'PostOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'profile',
            type: 'Profile',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'ProfileWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'profiles',
            type: 'Profile',
            isList: true,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'ProfileWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'ProfileOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'profilesConnection',
            type: 'ProfileConnection',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'ProfileWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'ProfileOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'user',
            type: 'User',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'UserWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'users',
            type: 'User',
            isList: true,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'UserWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'UserOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'usersConnection',
            type: 'UserConnection',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'UserWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'UserOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'node',
            type: 'Node',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'id',
                type: 'ID',
                isRequired: true,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'Post',
        fields: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'author',
            type: 'User',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'User',
        fields: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'strings',
            type: 'String',
            isList: true,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'posts',
            type: 'Post',
            isList: true,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'PostWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'orderBy',
                type: 'PostOrderByInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
              {
                name: 'skip',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'after',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'before',
                type: 'String',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'first',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
              {
                name: 'last',
                type: 'Int',
                isRequired: false,
                isScalar: true,
                isList: false,
              },
            ],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'PostConnection',
        fields: [
          {
            name: 'pageInfo',
            type: 'PageInfo',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'edges',
            type: 'PostEdge',
            isList: true,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'aggregate',
            type: 'AggregatePost',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'PageInfo',
        fields: [
          {
            name: 'hasNextPage',
            type: 'Boolean',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'hasPreviousPage',
            type: 'Boolean',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'startCursor',
            type: 'String',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'endCursor',
            type: 'String',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'PostEdge',
        fields: [
          {
            name: 'node',
            type: 'Post',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'cursor',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'AggregatePost',
        fields: [
          {
            name: 'count',
            type: 'Int',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'Profile',
        fields: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'url',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'ProfileConnection',
        fields: [
          {
            name: 'pageInfo',
            type: 'PageInfo',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'edges',
            type: 'ProfileEdge',
            isList: true,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'aggregate',
            type: 'AggregateProfile',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'ProfileEdge',
        fields: [
          {
            name: 'node',
            type: 'Profile',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'cursor',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'AggregateProfile',
        fields: [
          {
            name: 'count',
            type: 'Int',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'UserConnection',
        fields: [
          {
            name: 'pageInfo',
            type: 'PageInfo',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'edges',
            type: 'UserEdge',
            isList: true,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'aggregate',
            type: 'AggregateUser',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'UserEdge',
        fields: [
          {
            name: 'node',
            type: 'User',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'cursor',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'AggregateUser',
        fields: [
          {
            name: 'count',
            type: 'Int',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'Mutation',
        fields: [
          {
            name: 'createPost',
            type: 'Post',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'data',
                type: 'PostCreateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'updatePost',
            type: 'Post',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'data',
                type: 'PostUpdateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'where',
                type: 'PostWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'updateManyPosts',
            type: 'BatchPayload',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'data',
                type: 'PostUpdateManyMutationInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'where',
                type: 'PostWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'upsertPost',
            type: 'Post',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'PostWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'create',
                type: 'PostCreateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'update',
                type: 'PostUpdateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'deletePost',
            type: 'Post',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'PostWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'deleteManyPosts',
            type: 'BatchPayload',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'PostWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'createProfile',
            type: 'Profile',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'data',
                type: 'ProfileCreateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'updateProfile',
            type: 'Profile',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'data',
                type: 'ProfileUpdateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'where',
                type: 'ProfileWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'updateManyProfiles',
            type: 'BatchPayload',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'data',
                type: 'ProfileUpdateManyMutationInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'where',
                type: 'ProfileWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'upsertProfile',
            type: 'Profile',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'ProfileWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'create',
                type: 'ProfileCreateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'update',
                type: 'ProfileUpdateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'deleteProfile',
            type: 'Profile',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'ProfileWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'deleteManyProfiles',
            type: 'BatchPayload',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'ProfileWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'createUser',
            type: 'User',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'data',
                type: 'UserCreateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'updateUser',
            type: 'User',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'data',
                type: 'UserUpdateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'where',
                type: 'UserWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'updateManyUsers',
            type: 'BatchPayload',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'data',
                type: 'UserUpdateManyMutationInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'where',
                type: 'UserWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'upsertUser',
            type: 'User',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'UserWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'create',
                type: 'UserCreateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
              {
                name: 'update',
                type: 'UserUpdateInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'deleteUser',
            type: 'User',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'UserWhereUniqueInput',
                isRequired: true,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'deleteManyUsers',
            type: 'BatchPayload',
            isList: false,
            isRequired: true,
            args: [
              {
                name: 'where',
                type: 'UserWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'BatchPayload',
        fields: [
          {
            name: 'count',
            type: 'Long',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'Subscription',
        fields: [
          {
            name: 'post',
            type: 'PostSubscriptionPayload',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'PostSubscriptionWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'profile',
            type: 'ProfileSubscriptionPayload',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'ProfileSubscriptionWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
          {
            name: 'user',
            type: 'UserSubscriptionPayload',
            isList: false,
            isRequired: false,
            args: [
              {
                name: 'where',
                type: 'UserSubscriptionWhereInput',
                isRequired: false,
                isScalar: false,
                isList: false,
              },
            ],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'PostSubscriptionPayload',
        fields: [
          {
            name: 'mutation',
            type: 'MutationType',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'node',
            type: 'Post',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'relation',
          },
          {
            name: 'updatedFields',
            type: 'String',
            isList: true,
            isRequired: false,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'previousValues',
            type: 'PostPreviousValues',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'PostPreviousValues',
        fields: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'title',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'content',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'ProfileSubscriptionPayload',
        fields: [
          {
            name: 'mutation',
            type: 'MutationType',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'node',
            type: 'Profile',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'relation',
          },
          {
            name: 'updatedFields',
            type: 'String',
            isList: true,
            isRequired: false,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'previousValues',
            type: 'ProfilePreviousValues',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'ProfilePreviousValues',
        fields: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'url',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
      {
        name: 'UserSubscriptionPayload',
        fields: [
          {
            name: 'mutation',
            type: 'MutationType',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'relation',
          },
          {
            name: 'node',
            type: 'User',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'relation',
          },
          {
            name: 'updatedFields',
            type: 'String',
            isList: true,
            isRequired: false,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'previousValues',
            type: 'UserPreviousValues',
            isList: false,
            isRequired: false,
            args: [],
            kind: 'relation',
          },
        ],
      },
      {
        name: 'UserPreviousValues',
        fields: [
          {
            name: 'id',
            type: 'ID',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'name',
            type: 'String',
            isList: false,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
          {
            name: 'strings',
            type: 'String',
            isList: true,
            isRequired: true,
            args: [],
            kind: 'scalar',
          },
        ],
      },
    ],
  },
  mappings: [
    {
      model: 'User',
      findOne: 'user',
      findMany: 'users',
      create: 'createUser',
      update: 'updateUser',
      updateMany: 'updateManyUsers',
      upsert: 'upsertUser',
      delete: 'deleteUser',
      deleteMany: 'deleteManyUsers',
    },
    {
      model: 'Profile',
      findOne: 'profile',
      findMany: 'profiles',
      create: 'createProfile',
      update: 'updateProfile',
      updateMany: 'updateManyProfiles',
      upsert: 'upsertProfile',
      delete: 'deleteProfile',
      deleteMany: 'deleteManyProfiles',
    },
    {
      model: 'Post',
      findOne: 'post',
      findMany: 'posts',
      create: 'createPost',
      update: 'updatePost',
      updateMany: 'updateManyPosts',
      upsert: 'upsertPost',
      delete: 'deletePost',
      deleteMany: 'deleteManyPosts',
    },
  ],
}
