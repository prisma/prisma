/**
 * This file exports the `User` model and its related types.
 *
 * 🟢 You can import this file directly.
 */
import * as runtime from '@prisma/client/runtime/library'
import type * as $Enums from '../enums.js'
import type * as Prisma from '../internal/prismaNamespace.js'

/**
 * Model User
 *
 */
export type UserModel = runtime.Types.Result.DefaultSelection<Prisma.$UserPayload>

export type AggregateUser = {
  _count: UserCountAggregateOutputType | null
  _avg: UserAvgAggregateOutputType | null
  _sum: UserSumAggregateOutputType | null
  _min: UserMinAggregateOutputType | null
  _max: UserMaxAggregateOutputType | null
}

export type UserAvgAggregateOutputType = {
  decimal: runtime.Decimal | null
}

export type UserSumAggregateOutputType = {
  decimal: runtime.Decimal | null
}

export type UserMinAggregateOutputType = {
  id: string | null
  createdAt: Date | null
  updatedAt: Date | null
  name: string | null
  email: string | null
  date: Date | null
  decimal: runtime.Decimal | null
}

export type UserMaxAggregateOutputType = {
  id: string | null
  createdAt: Date | null
  updatedAt: Date | null
  name: string | null
  email: string | null
  date: Date | null
  decimal: runtime.Decimal | null
}

export type UserCountAggregateOutputType = {
  id: number
  createdAt: number
  updatedAt: number
  name: number
  email: number
  date: number
  decimal: number
  _all: number
}

export type UserAvgAggregateInputType = {
  decimal?: true
}

export type UserSumAggregateInputType = {
  decimal?: true
}

export type UserMinAggregateInputType = {
  id?: true
  createdAt?: true
  updatedAt?: true
  name?: true
  email?: true
  date?: true
  decimal?: true
}

export type UserMaxAggregateInputType = {
  id?: true
  createdAt?: true
  updatedAt?: true
  name?: true
  email?: true
  date?: true
  decimal?: true
}

export type UserCountAggregateInputType = {
  id?: true
  createdAt?: true
  updatedAt?: true
  name?: true
  email?: true
  date?: true
  decimal?: true
  _all?: true
}

export type UserAggregateArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Filter which User to aggregate.
   */
  where?: Prisma.UserWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Users to fetch.
   */
  orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the start position
   */
  cursor?: Prisma.UserWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Users from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Users.
   */
  skip?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Count returned Users
   **/
  _count?: true | UserCountAggregateInputType
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Select which fields to average
   **/
  _avg?: UserAvgAggregateInputType
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Select which fields to sum
   **/
  _sum?: UserSumAggregateInputType
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Select which fields to find the minimum value
   **/
  _min?: UserMinAggregateInputType
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Select which fields to find the maximum value
   **/
  _max?: UserMaxAggregateInputType
}

export type GetUserAggregateType<T extends UserAggregateArgs> = {
  [P in keyof T as P extends keyof AggregateUser ? P : never]: P extends '_count' | 'count'
    ? T[P] extends true
      ? number
      : Prisma.GetScalarType<T[P], AggregateUser[P & keyof AggregateUser]>
    : Prisma.GetScalarType<T[P], AggregateUser[P & keyof AggregateUser]>
}

export type UserGroupByArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  where?: Prisma.UserWhereInput
  orderBy?: Prisma.UserOrderByWithAggregationInput | Prisma.UserOrderByWithAggregationInput[]
  by: Prisma.UserScalarFieldEnum[] | Prisma.UserScalarFieldEnum
  having?: Prisma.UserScalarWhereWithAggregatesInput
  take?: number
  skip?: number
  _count?: UserCountAggregateInputType | true
  _avg?: UserAvgAggregateInputType
  _sum?: UserSumAggregateInputType
  _min?: UserMinAggregateInputType
  _max?: UserMaxAggregateInputType
}

export type UserGroupByOutputType = {
  id: string
  createdAt: Date
  updatedAt: Date
  name: string | null
  email: string
  date: Date | null
  decimal: runtime.Decimal | null
  _count: UserCountAggregateOutputType | null
  _avg: UserAvgAggregateOutputType | null
  _sum: UserSumAggregateOutputType | null
  _min: UserMinAggregateOutputType | null
  _max: UserMaxAggregateOutputType | null
}

type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
  Array<
    Prisma.PickEnumerable<UserGroupByOutputType, T['by']> & {
      [P in keyof T & keyof UserGroupByOutputType]: P extends '_count'
        ? T[P] extends boolean
          ? number
          : Prisma.GetScalarType<T[P], UserGroupByOutputType[P]>
        : Prisma.GetScalarType<T[P], UserGroupByOutputType[P]>
    }
  >
>

export type UserWhereInput = {
  AND?: Prisma.UserWhereInput | Prisma.UserWhereInput[]
  OR?: Prisma.UserWhereInput[]
  NOT?: Prisma.UserWhereInput | Prisma.UserWhereInput[]
  id?: Prisma.StringFilter<'User'> | string
  createdAt?: Prisma.DateTimeFilter<'User'> | Date | string
  updatedAt?: Prisma.DateTimeFilter<'User'> | Date | string
  name?: Prisma.StringNullableFilter<'User'> | string | null
  email?: Prisma.StringFilter<'User'> | string
  date?: Prisma.DateTimeNullableFilter<'User'> | Date | string | null
  decimal?: Prisma.DecimalNullableFilter<'User'> | runtime.Decimal | runtime.DecimalJsLike | number | string | null
  links?: Prisma.LinkListRelationFilter
}

export type UserOrderByWithRelationInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  name?: Prisma.SortOrderInput | Prisma.SortOrder
  email?: Prisma.SortOrder
  date?: Prisma.SortOrderInput | Prisma.SortOrder
  decimal?: Prisma.SortOrderInput | Prisma.SortOrder
  links?: Prisma.LinkOrderByRelationAggregateInput
}

export type UserWhereUniqueInput = Prisma.AtLeast<
  {
    id?: string
    email?: string
    AND?: Prisma.UserWhereInput | Prisma.UserWhereInput[]
    OR?: Prisma.UserWhereInput[]
    NOT?: Prisma.UserWhereInput | Prisma.UserWhereInput[]
    createdAt?: Prisma.DateTimeFilter<'User'> | Date | string
    updatedAt?: Prisma.DateTimeFilter<'User'> | Date | string
    name?: Prisma.StringNullableFilter<'User'> | string | null
    date?: Prisma.DateTimeNullableFilter<'User'> | Date | string | null
    decimal?: Prisma.DecimalNullableFilter<'User'> | runtime.Decimal | runtime.DecimalJsLike | number | string | null
    links?: Prisma.LinkListRelationFilter
  },
  'id' | 'email'
>

export type UserOrderByWithAggregationInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  name?: Prisma.SortOrderInput | Prisma.SortOrder
  email?: Prisma.SortOrder
  date?: Prisma.SortOrderInput | Prisma.SortOrder
  decimal?: Prisma.SortOrderInput | Prisma.SortOrder
  _count?: Prisma.UserCountOrderByAggregateInput
  _avg?: Prisma.UserAvgOrderByAggregateInput
  _max?: Prisma.UserMaxOrderByAggregateInput
  _min?: Prisma.UserMinOrderByAggregateInput
  _sum?: Prisma.UserSumOrderByAggregateInput
}

export type UserScalarWhereWithAggregatesInput = {
  AND?: Prisma.UserScalarWhereWithAggregatesInput | Prisma.UserScalarWhereWithAggregatesInput[]
  OR?: Prisma.UserScalarWhereWithAggregatesInput[]
  NOT?: Prisma.UserScalarWhereWithAggregatesInput | Prisma.UserScalarWhereWithAggregatesInput[]
  id?: Prisma.StringWithAggregatesFilter<'User'> | string
  createdAt?: Prisma.DateTimeWithAggregatesFilter<'User'> | Date | string
  updatedAt?: Prisma.DateTimeWithAggregatesFilter<'User'> | Date | string
  name?: Prisma.StringNullableWithAggregatesFilter<'User'> | string | null
  email?: Prisma.StringWithAggregatesFilter<'User'> | string
  date?: Prisma.DateTimeNullableWithAggregatesFilter<'User'> | Date | string | null
  decimal?:
    | Prisma.DecimalNullableWithAggregatesFilter<'User'>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

export type UserCreateInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  name?: string | null
  email: string
  date?: Date | string | null
  decimal?: runtime.Decimal | runtime.DecimalJsLike | number | string | null
  links?: Prisma.LinkCreateNestedManyWithoutUserInput
}

export type UserUncheckedCreateInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  name?: string | null
  email: string
  date?: Date | string | null
  decimal?: runtime.Decimal | runtime.DecimalJsLike | number | string | null
  links?: Prisma.LinkUncheckedCreateNestedManyWithoutUserInput
}

export type UserUpdateInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
  email?: Prisma.StringFieldUpdateOperationsInput | string
  date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  decimal?:
    | Prisma.NullableDecimalFieldUpdateOperationsInput
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
  links?: Prisma.LinkUpdateManyWithoutUserNestedInput
}

export type UserUncheckedUpdateInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
  email?: Prisma.StringFieldUpdateOperationsInput | string
  date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  decimal?:
    | Prisma.NullableDecimalFieldUpdateOperationsInput
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
  links?: Prisma.LinkUncheckedUpdateManyWithoutUserNestedInput
}

export type UserCreateManyInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  name?: string | null
  email: string
  date?: Date | string | null
  decimal?: runtime.Decimal | runtime.DecimalJsLike | number | string | null
}

export type UserUpdateManyMutationInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
  email?: Prisma.StringFieldUpdateOperationsInput | string
  date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  decimal?:
    | Prisma.NullableDecimalFieldUpdateOperationsInput
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

export type UserUncheckedUpdateManyInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
  email?: Prisma.StringFieldUpdateOperationsInput | string
  date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  decimal?:
    | Prisma.NullableDecimalFieldUpdateOperationsInput
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

export type UserNullableScalarRelationFilter = {
  is?: Prisma.UserWhereInput | null
  isNot?: Prisma.UserWhereInput | null
}

export type UserCountOrderByAggregateInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  name?: Prisma.SortOrder
  email?: Prisma.SortOrder
  date?: Prisma.SortOrder
  decimal?: Prisma.SortOrder
}

export type UserAvgOrderByAggregateInput = {
  decimal?: Prisma.SortOrder
}

export type UserMaxOrderByAggregateInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  name?: Prisma.SortOrder
  email?: Prisma.SortOrder
  date?: Prisma.SortOrder
  decimal?: Prisma.SortOrder
}

export type UserMinOrderByAggregateInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  name?: Prisma.SortOrder
  email?: Prisma.SortOrder
  date?: Prisma.SortOrder
  decimal?: Prisma.SortOrder
}

export type UserSumOrderByAggregateInput = {
  decimal?: Prisma.SortOrder
}

export type UserCreateNestedOneWithoutLinksInput = {
  create?: Prisma.XOR<Prisma.UserCreateWithoutLinksInput, Prisma.UserUncheckedCreateWithoutLinksInput>
  connectOrCreate?: Prisma.UserCreateOrConnectWithoutLinksInput
  connect?: Prisma.UserWhereUniqueInput
}

export type UserUpdateOneWithoutLinksNestedInput = {
  create?: Prisma.XOR<Prisma.UserCreateWithoutLinksInput, Prisma.UserUncheckedCreateWithoutLinksInput>
  connectOrCreate?: Prisma.UserCreateOrConnectWithoutLinksInput
  upsert?: Prisma.UserUpsertWithoutLinksInput
  disconnect?: Prisma.UserWhereInput | boolean
  delete?: Prisma.UserWhereInput | boolean
  connect?: Prisma.UserWhereUniqueInput
  update?: Prisma.XOR<
    Prisma.XOR<Prisma.UserUpdateToOneWithWhereWithoutLinksInput, Prisma.UserUpdateWithoutLinksInput>,
    Prisma.UserUncheckedUpdateWithoutLinksInput
  >
}

export type NullableDateTimeFieldUpdateOperationsInput = {
  set?: Date | string | null
}

export type NullableDecimalFieldUpdateOperationsInput = {
  set?: runtime.Decimal | runtime.DecimalJsLike | number | string | null
  increment?: runtime.Decimal | runtime.DecimalJsLike | number | string
  decrement?: runtime.Decimal | runtime.DecimalJsLike | number | string
  multiply?: runtime.Decimal | runtime.DecimalJsLike | number | string
  divide?: runtime.Decimal | runtime.DecimalJsLike | number | string
}

export type UserCreateWithoutLinksInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  name?: string | null
  email: string
  date?: Date | string | null
  decimal?: runtime.Decimal | runtime.DecimalJsLike | number | string | null
}

export type UserUncheckedCreateWithoutLinksInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  name?: string | null
  email: string
  date?: Date | string | null
  decimal?: runtime.Decimal | runtime.DecimalJsLike | number | string | null
}

export type UserCreateOrConnectWithoutLinksInput = {
  where: Prisma.UserWhereUniqueInput
  create: Prisma.XOR<Prisma.UserCreateWithoutLinksInput, Prisma.UserUncheckedCreateWithoutLinksInput>
}

export type UserUpsertWithoutLinksInput = {
  update: Prisma.XOR<Prisma.UserUpdateWithoutLinksInput, Prisma.UserUncheckedUpdateWithoutLinksInput>
  create: Prisma.XOR<Prisma.UserCreateWithoutLinksInput, Prisma.UserUncheckedCreateWithoutLinksInput>
  where?: Prisma.UserWhereInput
}

export type UserUpdateToOneWithWhereWithoutLinksInput = {
  where?: Prisma.UserWhereInput
  data: Prisma.XOR<Prisma.UserUpdateWithoutLinksInput, Prisma.UserUncheckedUpdateWithoutLinksInput>
}

export type UserUpdateWithoutLinksInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
  email?: Prisma.StringFieldUpdateOperationsInput | string
  date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  decimal?:
    | Prisma.NullableDecimalFieldUpdateOperationsInput
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

export type UserUncheckedUpdateWithoutLinksInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
  email?: Prisma.StringFieldUpdateOperationsInput | string
  date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  decimal?:
    | Prisma.NullableDecimalFieldUpdateOperationsInput
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

/**
 * Count Type UserCountOutputType
 */

export type UserCountOutputType = {
  links: number
}

export type UserCountOutputTypeSelect<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  links?: boolean | UserCountOutputTypeCountLinksArgs
}

/**
 * UserCountOutputType without action
 */
export type UserCountOutputTypeDefaultArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the UserCountOutputType
   */
  select?: Prisma.UserCountOutputTypeSelect<ExtArgs> | null
}

/**
 * UserCountOutputType without action
 */
export type UserCountOutputTypeCountLinksArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  where?: Prisma.LinkWhereInput
}

export type UserSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  runtime.Types.Extensions.GetSelect<
    {
      id?: boolean
      createdAt?: boolean
      updatedAt?: boolean
      name?: boolean
      email?: boolean
      date?: boolean
      decimal?: boolean
      links?: boolean | Prisma.User$linksArgs<ExtArgs>
      _count?: boolean | Prisma.UserCountOutputTypeDefaultArgs<ExtArgs>
    },
    ExtArgs['result']['user']
  >

export type UserSelectCreateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = runtime.Types.Extensions.GetSelect<
  {
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    name?: boolean
    email?: boolean
    date?: boolean
    decimal?: boolean
  },
  ExtArgs['result']['user']
>

export type UserSelectUpdateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = runtime.Types.Extensions.GetSelect<
  {
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    name?: boolean
    email?: boolean
    date?: boolean
    decimal?: boolean
  },
  ExtArgs['result']['user']
>

export type UserSelectScalar = {
  id?: boolean
  createdAt?: boolean
  updatedAt?: boolean
  name?: boolean
  email?: boolean
  date?: boolean
  decimal?: boolean
}

export type UserOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  runtime.Types.Extensions.GetOmit<
    'id' | 'createdAt' | 'updatedAt' | 'name' | 'email' | 'date' | 'decimal',
    ExtArgs['result']['user']
  >
export type UserInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  {
    links?: boolean | Prisma.User$linksArgs<ExtArgs>
    _count?: boolean | Prisma.UserCountOutputTypeDefaultArgs<ExtArgs>
  }
export type UserIncludeCreateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {}
export type UserIncludeUpdateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {}

export type $UserPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  {
    name: 'User'
    objects: {
      links: Prisma.$LinkPayload<ExtArgs>[]
    }
    scalars: runtime.Types.Extensions.GetPayloadResult<
      {
        id: string
        createdAt: Date
        updatedAt: Date
        name: string | null
        email: string
        date: Date | null
        decimal: runtime.Decimal | null
      },
      ExtArgs['result']['user']
    >
    composites: {}
  }

export type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = runtime.Types.Result.GetResult<
  Prisma.$UserPayload,
  S
>

export type UserCountArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
  select?: UserCountAggregateInputType | true
}

export interface UserDelegate<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
  GlobalOmitOptions = {},
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User']; meta: { name: 'User' } }
  /**
   * Find zero or one User that matches the filter.
   * @param {UserFindUniqueArgs} args - Arguments to find a User
   * @example
   * // Get one User
   * const user = await prisma.user.findUnique({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findUnique<T extends UserFindUniqueArgs>(
    args: Prisma.SelectSubset<T, UserFindUniqueArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null,
    null,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find one User that matches the filter or throw an error with `error.code='P2025'`
   * if no matches were found.
   * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
   * @example
   * // Get one User
   * const user = await prisma.user.findUniqueOrThrow({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(
    args: Prisma.SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find the first User that matches the filter.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserFindFirstArgs} args - Arguments to find a User
   * @example
   * // Get one User
   * const user = await prisma.user.findFirst({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findFirst<T extends UserFindFirstArgs>(
    args?: Prisma.SelectSubset<T, UserFindFirstArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null,
    null,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find the first User that matches the filter or
   * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
   * @example
   * // Get one User
   * const user = await prisma.user.findFirstOrThrow({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(
    args?: Prisma.SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find zero or more Users that matches the filter.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Users
   * const users = await prisma.user.findMany()
   *
   * // Get first 10 Users
   * const users = await prisma.user.findMany({ take: 10 })
   *
   * // Only select the `id`
   * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
   *
   */
  findMany<T extends UserFindManyArgs>(
    args?: Prisma.SelectSubset<T, UserFindManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>
  >

  /**
   * Create a User.
   * @param {UserCreateArgs} args - Arguments to create a User.
   * @example
   * // Create one User
   * const User = await prisma.user.create({
   *   data: {
   *     // ... data to create a User
   *   }
   * })
   *
   */
  create<T extends UserCreateArgs>(
    args: Prisma.SelectSubset<T, UserCreateArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'create', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Create many Users.
   * @param {UserCreateManyArgs} args - Arguments to create many Users.
   * @example
   * // Create many Users
   * const user = await prisma.user.createMany({
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   *
   */
  createMany<T extends UserCreateManyArgs>(
    args?: Prisma.SelectSubset<T, UserCreateManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<Prisma.BatchPayload>

  /**
   * Create many Users and returns the data saved in the database.
   * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
   * @example
   * // Create many Users
   * const user = await prisma.user.createManyAndReturn({
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   *
   * // Create many Users and only return the `id`
   * const userWithIdOnly = await prisma.user.createManyAndReturn({
   *   select: { id: true },
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   *
   */
  createManyAndReturn<T extends UserCreateManyAndReturnArgs>(
    args?: Prisma.SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>
  >

  /**
   * Delete a User.
   * @param {UserDeleteArgs} args - Arguments to delete one User.
   * @example
   * // Delete one User
   * const User = await prisma.user.delete({
   *   where: {
   *     // ... filter to delete one User
   *   }
   * })
   *
   */
  delete<T extends UserDeleteArgs>(
    args: Prisma.SelectSubset<T, UserDeleteArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Update one User.
   * @param {UserUpdateArgs} args - Arguments to update one User.
   * @example
   * // Update one User
   * const user = await prisma.user.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   *
   */
  update<T extends UserUpdateArgs>(
    args: Prisma.SelectSubset<T, UserUpdateArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'update', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Delete zero or more Users.
   * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
   * @example
   * // Delete a few Users
   * const { count } = await prisma.user.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   *
   */
  deleteMany<T extends UserDeleteManyArgs>(
    args?: Prisma.SelectSubset<T, UserDeleteManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<Prisma.BatchPayload>

  /**
   * Update zero or more Users.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Users
   * const user = await prisma.user.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   *
   */
  updateMany<T extends UserUpdateManyArgs>(
    args: Prisma.SelectSubset<T, UserUpdateManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<Prisma.BatchPayload>

  /**
   * Update zero or more Users and returns the data updated in the database.
   * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
   * @example
   * // Update many Users
   * const user = await prisma.user.updateManyAndReturn({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   *
   * // Update zero or more Users and only return the `id`
   * const userWithIdOnly = await prisma.user.updateManyAndReturn({
   *   select: { id: true },
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   *
   */
  updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(
    args: Prisma.SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>
  >

  /**
   * Create or update one User.
   * @param {UserUpsertArgs} args - Arguments to update or create a User.
   * @example
   * // Update or create a User
   * const user = await prisma.user.upsert({
   *   create: {
   *     // ... data to create a User
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the User we want to update
   *   }
   * })
   */
  upsert<T extends UserUpsertArgs>(
    args: Prisma.SelectSubset<T, UserUpsertArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Count the number of Users.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserCountArgs} args - Arguments to filter Users to count.
   * @example
   * // Count the number of Users
   * const count = await prisma.user.count({
   *   where: {
   *     // ... the filter for the Users we want to count
   *   }
   * })
   **/
  count<T extends UserCountArgs>(
    args?: Prisma.Subset<T, UserCountArgs>,
  ): Prisma.PrismaPromise<
    T extends runtime.Types.Utils.Record<'select', any>
      ? T['select'] extends true
        ? number
        : Prisma.GetScalarType<T['select'], UserCountAggregateOutputType>
      : number
  >

  /**
   * Allows you to perform aggregations operations on a User.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
   * @example
   * // Ordered by age ascending
   * // Where email contains prisma.io
   * // Limited to the 10 users
   * const aggregations = await prisma.user.aggregate({
   *   _avg: {
   *     age: true,
   *   },
   *   where: {
   *     email: {
   *       contains: "prisma.io",
   *     },
   *   },
   *   orderBy: {
   *     age: "asc",
   *   },
   *   take: 10,
   * })
   **/
  aggregate<T extends UserAggregateArgs>(
    args: Prisma.Subset<T, UserAggregateArgs>,
  ): Prisma.PrismaPromise<GetUserAggregateType<T>>

  /**
   * Group by User.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {UserGroupByArgs} args - Group by arguments.
   * @example
   * // Group by city, order by createdAt, get count
   * const result = await prisma.user.groupBy({
   *   by: ['city', 'createdAt'],
   *   orderBy: {
   *     createdAt: true
   *   },
   *   _count: {
   *     _all: true
   *   },
   * })
   *
   **/
  groupBy<
    T extends UserGroupByArgs,
    HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>,
    OrderByArg extends Prisma.True extends HasSelectOrTake
      ? { orderBy: UserGroupByArgs['orderBy'] }
      : { orderBy?: UserGroupByArgs['orderBy'] },
    OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>,
    ByFields extends Prisma.MaybeTupleToUnion<T['by']>,
    ByValid extends Prisma.Has<ByFields, OrderFields>,
    HavingFields extends Prisma.GetHavingFields<T['having']>,
    HavingValid extends Prisma.Has<ByFields, HavingFields>,
    ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False,
    InputErrors extends ByEmpty extends Prisma.True
      ? `Error: "by" must not be empty.`
      : HavingValid extends Prisma.False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`]
        }[HavingFields]
      : 'take' extends Prisma.Keys<T>
      ? 'orderBy' extends Prisma.Keys<T>
        ? ByValid extends Prisma.True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Prisma.Keys<T>
      ? 'orderBy' extends Prisma.Keys<T>
        ? ByValid extends Prisma.True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends Prisma.True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields],
  >(
    args: Prisma.SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors,
  ): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs
}

/**
 * The delegate class that acts as a "Promise-like" for User.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__UserClient<
  T,
  Null = never,
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
  GlobalOmitOptions = {},
> extends Prisma.PrismaPromise<T> {
  readonly [Symbol.toStringTag]: 'PrismaPromise'
  links<T extends Prisma.User$linksArgs<ExtArgs> = {}>(
    args?: Prisma.Subset<T, Prisma.User$linksArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions> | Null
  >
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): runtime.Types.Utils.JsPromise<TResult1 | TResult2>
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): runtime.Types.Utils.JsPromise<T | TResult>
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>
}

/**
 * Fields of the User model
 */
export interface UserFieldRefs {
  readonly id: Prisma.FieldRef<'User', 'String'>
  readonly createdAt: Prisma.FieldRef<'User', 'DateTime'>
  readonly updatedAt: Prisma.FieldRef<'User', 'DateTime'>
  readonly name: Prisma.FieldRef<'User', 'String'>
  readonly email: Prisma.FieldRef<'User', 'String'>
  readonly date: Prisma.FieldRef<'User', 'DateTime'>
  readonly decimal: Prisma.FieldRef<'User', 'Decimal'>
}

// Custom InputTypes
/**
 * User findUnique
 */
export type UserFindUniqueArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * Filter, which User to fetch.
   */
  where: Prisma.UserWhereUniqueInput
}

/**
 * User findUniqueOrThrow
 */
export type UserFindUniqueOrThrowArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * Filter, which User to fetch.
   */
  where: Prisma.UserWhereUniqueInput
}

/**
 * User findFirst
 */
export type UserFindFirstArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * Filter, which User to fetch.
   */
  where?: Prisma.UserWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Users to fetch.
   */
  orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the position for searching for Users.
   */
  cursor?: Prisma.UserWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Users from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Users.
   */
  skip?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
   *
   * Filter by unique combinations of Users.
   */
  distinct?: Prisma.UserScalarFieldEnum | Prisma.UserScalarFieldEnum[]
}

/**
 * User findFirstOrThrow
 */
export type UserFindFirstOrThrowArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * Filter, which User to fetch.
   */
  where?: Prisma.UserWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Users to fetch.
   */
  orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the position for searching for Users.
   */
  cursor?: Prisma.UserWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Users from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Users.
   */
  skip?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
   *
   * Filter by unique combinations of Users.
   */
  distinct?: Prisma.UserScalarFieldEnum | Prisma.UserScalarFieldEnum[]
}

/**
 * User findMany
 */
export type UserFindManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * Filter, which Users to fetch.
   */
  where?: Prisma.UserWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Users to fetch.
   */
  orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the position for listing Users.
   */
  cursor?: Prisma.UserWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Users from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Users.
   */
  skip?: number
  distinct?: Prisma.UserScalarFieldEnum | Prisma.UserScalarFieldEnum[]
}

/**
 * User create
 */
export type UserCreateArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * The data needed to create a User.
   */
  data: Prisma.XOR<Prisma.UserCreateInput, Prisma.UserUncheckedCreateInput>
}

/**
 * User createMany
 */
export type UserCreateManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * The data used to create many Users.
   */
  data: Prisma.UserCreateManyInput | Prisma.UserCreateManyInput[]
}

/**
 * User createManyAndReturn
 */
export type UserCreateManyAndReturnArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelectCreateManyAndReturn<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * The data used to create many Users.
   */
  data: Prisma.UserCreateManyInput | Prisma.UserCreateManyInput[]
}

/**
 * User update
 */
export type UserUpdateArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * The data needed to update a User.
   */
  data: Prisma.XOR<Prisma.UserUpdateInput, Prisma.UserUncheckedUpdateInput>
  /**
   * Choose, which User to update.
   */
  where: Prisma.UserWhereUniqueInput
}

/**
 * User updateMany
 */
export type UserUpdateManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * The data used to update Users.
   */
  data: Prisma.XOR<Prisma.UserUpdateManyMutationInput, Prisma.UserUncheckedUpdateManyInput>
  /**
   * Filter which Users to update
   */
  where?: Prisma.UserWhereInput
  /**
   * Limit how many Users to update.
   */
  limit?: number
}

/**
 * User updateManyAndReturn
 */
export type UserUpdateManyAndReturnArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelectUpdateManyAndReturn<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * The data used to update Users.
   */
  data: Prisma.XOR<Prisma.UserUpdateManyMutationInput, Prisma.UserUncheckedUpdateManyInput>
  /**
   * Filter which Users to update
   */
  where?: Prisma.UserWhereInput
  /**
   * Limit how many Users to update.
   */
  limit?: number
}

/**
 * User upsert
 */
export type UserUpsertArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * The filter to search for the User to update in case it exists.
   */
  where: Prisma.UserWhereUniqueInput
  /**
   * In case the User found by the `where` argument doesn't exist, create a new User with this data.
   */
  create: Prisma.XOR<Prisma.UserCreateInput, Prisma.UserUncheckedCreateInput>
  /**
   * In case the User was found with the provided `where` argument, update it with this data.
   */
  update: Prisma.XOR<Prisma.UserUpdateInput, Prisma.UserUncheckedUpdateInput>
}

/**
 * User delete
 */
export type UserDeleteArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
  /**
   * Filter which User to delete.
   */
  where: Prisma.UserWhereUniqueInput
}

/**
 * User deleteMany
 */
export type UserDeleteManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Filter which Users to delete
   */
  where?: Prisma.UserWhereInput
  /**
   * Limit how many Users to delete.
   */
  limit?: number
}

/**
 * User.links
 */
export type User$linksArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the Link
   */
  select?: Prisma.LinkSelect<ExtArgs> | null
  /**
   * Omit specific fields from the Link
   */
  omit?: Prisma.LinkOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.LinkInclude<ExtArgs> | null
  where?: Prisma.LinkWhereInput
  orderBy?: Prisma.LinkOrderByWithRelationInput | Prisma.LinkOrderByWithRelationInput[]
  cursor?: Prisma.LinkWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Prisma.LinkScalarFieldEnum | Prisma.LinkScalarFieldEnum[]
}

/**
 * User without action
 */
export type UserDefaultArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the User
   */
  select?: Prisma.UserSelect<ExtArgs> | null
  /**
   * Omit specific fields from the User
   */
  omit?: Prisma.UserOmit<ExtArgs> | null
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.UserInclude<ExtArgs> | null
}
