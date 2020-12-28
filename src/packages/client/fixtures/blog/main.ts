import { Prisma, PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

async function main() {
  prisma.$on('query', (q) => {
    console.log({ q })
  })

  const res = await prisma.user.groupBy({
    by: ['age', 'email'],
    avg: {
      age: true,
    },
    take: 0,

    // count: {
    //   _all: true,
    // },
  })

  // res.count._all

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})

export type Key = string | number | symbol

type MergeProp<OK, O1K, K extends Key, OOK extends Key> = K extends OOK
  ? Exclude<OK, undefined> | O1K
  : [OK] extends [never]
  ? O1K
  : OK extends undefined
  ? O1K
  : OK

export type AtBasic<O extends object, K extends Key> = K extends keyof O
  ? O[K]
  : never

export type _OptionalKeys<O extends object> = {
  [K in keyof O]-?: {} extends Pick<O, K> ? K : never
}[keyof O]

type Merge<
  O extends object,
  O1 extends object,
  OOK extends Key = _OptionalKeys<O>
> = {
  [K in keyof (O & O1)]: MergeProp<AtBasic<O, K>, AtBasic<O1, K>, K, OOK>
}

export type Spread<L extends object, R extends object> = Id<
  // Merge the properties of L and R into a partial (preserving order).
  Partial<{ [P in keyof (L & R)]: SpreadProp<L, R, P> }> &
    // Restore any required L-exclusive properties.
    Pick<L, Exclude<keyof L, keyof R>> &
    // Restore any required R properties.
    Pick<R, RequiredProps<R>>
>

/** Merge a property from `R` to `L` like the spread operator. */
type SpreadProp<
  L extends object,
  R extends object,
  P extends keyof (L & R)
> = P extends keyof R
  ? undefined extends R[P]
    ? L[Extract<P, keyof L>] | R[P]
    : R[P]
  : L[Extract<P, keyof L>]

/** Property names that are always defined */
type RequiredProps<T extends object> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P
}[keyof T]

type Id<T> = { [P in keyof T]: T[P] }

type ReqOrderBy = { orderBy: Prisma.GroupByUserArgs['orderBy'] }

export type Tail<T extends any[]> = T['length'] extends 0
  ? never
  : T extends [any, ...infer Tail]
  ? Tail
  : T

type GetFieldsFromOrderBy<
  T extends Prisma.Enumerable<Prisma.UserOrderByInput> | undefined
> = T extends Record<string, 'asc' | 'desc'>
  ? keyof T
  : T extends [infer U]
  ? keyof U
  : T extends [infer U, infer K]
  ? keyof U | keyof K
  : T extends [infer U, infer K, infer D]
  ? keyof U | keyof K | keyof D
  : T extends [infer U, infer K, infer D, infer N]
  ? keyof U | keyof K | keyof D | keyof N
  : T extends [infer U, infer K, infer D, infer N, infer B]
  ? keyof U | keyof K | keyof D | keyof N | keyof B
  : T extends [infer U, infer K, infer D, infer N, infer B, infer Y]
  ? keyof U | keyof K | keyof D | keyof N | keyof B | keyof Y
  : T extends [infer U, infer K, infer D, infer N, infer B, infer Y, infer Z]
  ? keyof U | keyof K | keyof D | keyof N | keyof B | keyof Y | keyof Z
  : never

type Yess = GetFieldsFromOrderBy<
  [{ age: 'desc' }, { email: 'asc' }, { propertyId: 'asc' }]
>

/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export type Subset<T, U, K> = {
  [key in keyof T]: key extends keyof U ? T[key] : never
} &
  K

/**
 * Convert tuple to union
 */
type _TupleToUnion<T> = T extends (infer E)[] ? E : never
type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

/**
 * Like `Pick`, but with an array
 */
type PickArray<T, K extends Array<keyof T>> = Pick<T, TupleToUnion<K>>

type GetUserGroupByPayload<T extends Prisma.GroupByUserArgs> = PickArray<
  Prisma.UserGroupByOutputType,
  T['by']
>

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

export type Union = any
export type IntersectOf<U extends Union> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

/**
A [[Boolean]]
*/
export type Boolean = True | False

// /**
// 1
// */
export type True = 1

/**
0
*/
export type False = 0

export type Not<B extends Boolean> = {
  0: 1
  1: 0
}[B]

export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
  ? 0 // anything `never` is false
  : A1 extends A2
  ? 1
  : 0

export type Has<U extends Union, U1 extends Union> = Not<
  Extends<Exclude<U1, U>, U1>
>

export type Or<B1 extends Boolean, B2 extends Boolean> = {
  0: {
    0: 0
    1: 1
  }
  1: {
    0: 1
    1: 1
  }
}[B1][B2]

declare function groupBy<
  T extends Prisma.GroupByUserArgs,
  HasSelectOrTake extends Or<
    Extends<'skip', Keys<T>>,
    Extends<'take', Keys<T>>
  >,
  U extends True extends HasSelectOrTake
    ? ReqOrderBy
    : { orderBy?: Prisma.GroupByUserArgs['orderBy'] },
  OrderFields extends Keys<MaybeTupleToUnion<T['orderBy']>>,
  ByFields extends TupleToUnion<T['by']>,
  ByValid extends Has<ByFields, OrderFields>
>(
  args: Subset<T, Prisma.GroupByUserArgs, U>,
): 'take' extends Keys<T>
  ? 'orderBy' extends Keys<T>
    ? ByValid extends True
      ? Prisma.GetUserGroupByPayload<T>
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : [Error, `Field "${P}" in "orderBy" needs to be provided in "by"`]
        }[OrderFields]
    : [Error, 'If you provide "take", you also need to provide "orderBy"']
  : 'skip' extends Keys<T>
  ? 'orderBy' extends Keys<T>
    ? ByValid extends True
      ? Prisma.GetUserGroupByPayload<T>
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : [Error, `Field "${P}" in "orderBy" needs to be provided in "by"`]
        }[OrderFields]
    : [Error, 'If you provide "skip", you also need to provide "orderBy"']
  : Prisma.GetUserGroupByPayload<T>

//GetMissingOrT<Keys<MaybeTupleToUnion<T['orderBy']>>, TupleToUnion<T['by']>, {hello: 'world'}>

type MyKeyOf<T> = keyof T
export type Keys<U extends Union> = U extends unknown ? keyof U : never

type X = { a: 1 } | { b: 2 }

type XZ = IntersectOf<X>

const xz: XZ = null as any

async function gain() {
  const res = await groupBy({
    by: ['id', 'email', 'age'],
    // skip: 0,
    take: 10,
    orderBy: [
      {
        age: 'desc',
      },
      {
        email: 'asc',
      },
      // {
      //   propertyId: 'asc',
      // },
    ],

    // orderBy: {
    //   age: 'asc',
    // },

    // blue: 'string',
    max: {
      age: true,
    },
  })

  res.max.age

  type xxx = keyof typeof res

  // res.skip

  // res.id
}

type RequiredSet = 'b'

type GivenSet = 'b' | 'c'

type CleanupNever<T> = {
  [P in RequiredKeys<T>]: T[P] extends never ? never : T[P]
}

export type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K
  // eslint-disable-next-line @typescript-eslint/ban-types
} extends { [_ in keyof T]: infer U }
  ? {} extends U
    ? never
    : U
  : never

type GetMissing<Required extends any, Given extends any> = {
  [P in Keys<Required>]: P extends Given
    ? never
    : [`Error: Field "{P}" in "orderBy" needs to be provided in "by"`, P]
} //[Required]

type GetMissingOrT<Required, Given, T, U = GetMissing<Required, Given>> = U //{req: Required, giv: Given} //never extends U ? T : U

// type Missi = GetMissingOrT<RequiredSet, GivenSet, {blub: 1}>

type TT = {
  skip: 0
}

type Mu = TT extends Record<'skip' | 'mip', any> ? 'yes' : 'no'

type MySoloMerge<T> = {
  [P in keyof T]: T[P]
}

type MyMerge<T, U> = {
  [P in keyof T | keyof U]: P extends keyof T
    ? T[P]
    : P extends keyof U
    ? U[P]
    : never
}

type A = {
  id?: number
}

type B = {
  name: string
}

type C = MyMerge<A, B>
