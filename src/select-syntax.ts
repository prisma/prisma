/**
 * Utility Types
 */

/**
 * Intersection
 * @desc From `T` pick properties that exist in `U`
 */
export type Intersection<T extends object, U extends object> = T extends any
  ? Pick<T, SetIntersection<keyof T, keyof U>>
  : never

/**
 * Diff
 * @desc From `T` remove properties that exist in `U`
 */
export type Diff<T extends object, U extends object> = Pick<T, SetDifference<keyof T, keyof U>>

/**
 * SetIntersection (same as Extract)
 * @desc Set intersection of given union types `A` and `B`
 */
export type SetIntersection<A, B> = A extends B ? A : never

/**
 * SetDifference (same as Exclude)
 * @desc Set difference of given union types `A` and `B`
 */
export type SetDifference<A, B> = A extends B ? never : A

export type MergeTruthyValues<
  T extends object,
  U extends object,
  ValueType = false,
  I = Diff<T, U> & Intersection<U, T> & Diff<U, T>
> = Pick<I, { [Key in keyof I]: I[Key] extends ValueType ? never : Key }[keyof I]>

/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export type Subset<T, U> = { [key in keyof T]: key extends keyof U ? T[key] : never }

/**
 * Lib
 */

/**
 * Types
 */

type User = {
  id: string
  name: string
  email: string
}

type User_scalarFields = 'id' | 'name' | 'email'

type Profile = {
  id: string
  url: string
}

type Profile_scalarFields = 'id' | 'url'

type Post = {
  id: string
  title: string
  body: string
}

type Post_scalarFields = 'id' | 'title' | 'body'

type Comment = {
  id: string
  text: string
}

type Comment_scalarFields = 'id' | 'text'

type House = {
  id: string
  address: string
}

type House_scalarFields = 'id' | 'address'

/**
 * Args
 */

type UserArgs = {
  where?: any
  select?: User_select
}

type UserYesArgs = {
  select: User_select
}

type ProfileArgs = {
  select?: Profile_select
}

type HouseArgs = {
  select?: House_select
}

type PostArgs = {
  select?: Post_select
}

/**
 * Selection
 */

type User_select = {
  id: boolean
  name?: boolean
  email?: boolean
  profile?: boolean | ProfileArgs
  friends?: boolean | UserArgs
  house?: boolean | HouseArgs
  posts?: boolean | PostArgs
}

type House_select = {
  id?: boolean
  address?: boolean
}

type Post_select = {
  id?: boolean
  title?: boolean
  body?: boolean
  comments?: boolean | Comment_select
}

type Comment_select = {
  id?: boolean
  text?: boolean
}

type Profile_select = {
  id?: boolean
  url?: boolean
}

/**
 * Default selections
 */

type User_default = {
  id: true
  name: true
  email: true
  profile: true
}

type Post_default = {
  id: true
  title: true
  body: true
}

type House_default = {
  id: true
  address: true
}

type Profile_default = {
  id: true
  url: true
}

type Comment_default = {
  id: true
  text: true
}

type Deep = {
  asd: {
    asd: number
  }
}

type deep = Deep['asd']['asd']

type ExtractFriendsSelect<S extends User_select> = 'friends' extends keyof S
  ? S['friends'] extends boolean
    ? S['friends']
    : S['friends'] extends UserYesArgs
    ? S['friends']['select']
    : false
  : false
type ExtractSelect<S extends boolean | UserArgs> = S extends boolean ? S : S extends UserYesArgs ? S['select'] : false

/**
 * Payload Extractors
 */
type User_getPayload<S extends boolean | User_select> = S extends true
  ? User
  : S extends User_select
  ? {
      [P in keyof MergeTruthyValues<User_default, S>]: P extends User_scalarFields
        ? User[P]
        : P extends 'profile'
        ? Profile_getPayload<S[P]>
        : P extends 'friends'
        ? Array<User_getPayload<ExtractSelect<S[P]>>>
        : P extends 'house'
        ? House_getPayload<S[P]>
        : P extends 'posts'
        ? Array<Post_getPayload<S[P]>>
        : never
    }
  : never

// type User_getPayload<
//   S extends boolean | UserArgs /*, T = S extends UserArgs ? 'select' extends keyof S ? S['select'] : never : never*/
// > = S extends true
//   ? User
//   : S extends UserArgs
//   ? {
//       [P in keyof S]: P extends 'select'
//         ? {
//             [K in keyof MergeTruthyValues<User_default, S[P]>]: K extends User_scalarFields
//               ? User[K]
//               : K extends 'profile'
//               ? Profile_getPayload<S[P][K]>
//               : K extends 'friends'
//               ? Array<User_getPayload<S[P][K]>>
//               : K extends 'house'
//               ? House_getPayload<S[P][K]>
//               : K extends 'posts'
//               ? Array<Post_getPayload<S[P][K]>>
//               : never
//           }
//         : never
//     }
//   : never

// type Post_getPayload<S extends boolean | PostArgs> = S

type Post_getPayload<
  S extends boolean | PostArgs,
  T extends object = S extends PostArgs ? ('select' extends keyof S ? S['select'] : never) : never,
  U = MergeTruthyValues<Post_default, T>
> = S extends true
  ? Post
  : T extends Post_select
  ? 'select' extends keyof S
    ? {
        [P in keyof U]: P extends Post_scalarFields
          ? Post[P]
          : P extends 'comments'
          ? Array<Comment_getPayload<T[P]>>
          : never
      }
    : never
  : never

type House_getPayload<S extends boolean | HouseArgs> = S extends true
  ? House
  : S extends House_select
  ? { [P in keyof MergeTruthyValues<House_default, S>]: P extends House_scalarFields ? House[P] : never }
  : never

type Profile_getPayload<S extends boolean | ProfileArgs> = S extends true
  ? Profile
  : S extends Profile_select
  ? { [P in keyof MergeTruthyValues<Profile_default, S>]: P extends keyof Profile ? Profile[P] : never } // this is a limitation in TS I need to understand better. // When passing in profile: true, TS is turning it into unknown. Dunno why
  : S extends unknown
  ? Profile
  : never

type Comment_getPayload<S extends boolean | Comment_select> = S extends true
  ? Comment
  : S extends Comment_select
  ? { [P in keyof MergeTruthyValues<Comment_default, S>]: P extends keyof Comment ? Comment[P] : never }
  : never

type Prisma = {
  // users: <T extends UserArgs>(args?: Subset<T, UserArgs>) => Promise<Array<User_getPayload<T>>>
  users: <T extends UserArgs>(
    args?: Subset<T, UserArgs>,
  ) => 'select' extends keyof T ? Promise<Array<User_getPayload<T['select']>>> : Promise<User[]>
}

const prisma: Prisma = {
  users: () => Promise.resolve([]) as any,
}

type Payload<T extends (...args: any[]) => Promise<any>> = T extends (...args: any[]) => Promise<[infer R, any]>
  ? R
  : any

async function getDeepUsers() {
  const x = await prisma.users({
    select: {
      id: true,
      posts: {},
    },
  })
  // x[0].email
  // x[0].posts
}

export type DeepUsers = typeof getDeepUsers
