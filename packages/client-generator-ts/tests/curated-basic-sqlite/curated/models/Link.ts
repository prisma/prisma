/**
 * This file exports the `Link` model and its related types.
 *
 * 🟢 You can import this file directly.
 */
import * as runtime from '@prisma/client/runtime/library'
import type * as $Enums from '../enums.js'
import type * as Prisma from '../internal/prismaNamespace.js'

/**
 * Model Link
 *
 */
export type LinkModel = runtime.Types.Result.DefaultSelection<Prisma.$LinkPayload>

export type AggregateLink = {
  _count: LinkCountAggregateOutputType | null
  _min: LinkMinAggregateOutputType | null
  _max: LinkMaxAggregateOutputType | null
}

export type LinkMinAggregateOutputType = {
  id: string | null
  createdAt: Date | null
  updatedAt: Date | null
  url: string | null
  shortUrl: string | null
  userId: string | null
}

export type LinkMaxAggregateOutputType = {
  id: string | null
  createdAt: Date | null
  updatedAt: Date | null
  url: string | null
  shortUrl: string | null
  userId: string | null
}

export type LinkCountAggregateOutputType = {
  id: number
  createdAt: number
  updatedAt: number
  url: number
  shortUrl: number
  userId: number
  _all: number
}

export type LinkMinAggregateInputType = {
  id?: true
  createdAt?: true
  updatedAt?: true
  url?: true
  shortUrl?: true
  userId?: true
}

export type LinkMaxAggregateInputType = {
  id?: true
  createdAt?: true
  updatedAt?: true
  url?: true
  shortUrl?: true
  userId?: true
}

export type LinkCountAggregateInputType = {
  id?: true
  createdAt?: true
  updatedAt?: true
  url?: true
  shortUrl?: true
  userId?: true
  _all?: true
}

export type LinkAggregateArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Filter which Link to aggregate.
   */
  where?: Prisma.LinkWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Links to fetch.
   */
  orderBy?: Prisma.LinkOrderByWithRelationInput | Prisma.LinkOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the start position
   */
  cursor?: Prisma.LinkWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Links from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Links.
   */
  skip?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Count returned Links
   **/
  _count?: true | LinkCountAggregateInputType
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Select which fields to find the minimum value
   **/
  _min?: LinkMinAggregateInputType
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
   *
   * Select which fields to find the maximum value
   **/
  _max?: LinkMaxAggregateInputType
}

export type GetLinkAggregateType<T extends LinkAggregateArgs> = {
  [P in keyof T & keyof AggregateLink]: P extends '_count' | 'count'
    ? T[P] extends true
      ? number
      : Prisma.GetScalarType<T[P], AggregateLink[P]>
    : Prisma.GetScalarType<T[P], AggregateLink[P]>
}

export type LinkGroupByArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  where?: Prisma.LinkWhereInput
  orderBy?: Prisma.LinkOrderByWithAggregationInput | Prisma.LinkOrderByWithAggregationInput[]
  by: Prisma.LinkScalarFieldEnum[] | Prisma.LinkScalarFieldEnum
  having?: Prisma.LinkScalarWhereWithAggregatesInput
  take?: number
  skip?: number
  _count?: LinkCountAggregateInputType | true
  _min?: LinkMinAggregateInputType
  _max?: LinkMaxAggregateInputType
}

export type LinkGroupByOutputType = {
  id: string
  createdAt: Date
  updatedAt: Date
  url: string
  shortUrl: string
  userId: string | null
  _count: LinkCountAggregateOutputType | null
  _min: LinkMinAggregateOutputType | null
  _max: LinkMaxAggregateOutputType | null
}

type GetLinkGroupByPayload<T extends LinkGroupByArgs> = Prisma.PrismaPromise<
  Array<
    Prisma.PickEnumerable<LinkGroupByOutputType, T['by']> & {
      [P in keyof T & keyof LinkGroupByOutputType]: P extends '_count'
        ? T[P] extends boolean
          ? number
          : Prisma.GetScalarType<T[P], LinkGroupByOutputType[P]>
        : Prisma.GetScalarType<T[P], LinkGroupByOutputType[P]>
    }
  >
>

export type LinkWhereInput = {
  AND?: Prisma.LinkWhereInput | Prisma.LinkWhereInput[]
  OR?: Prisma.LinkWhereInput[]
  NOT?: Prisma.LinkWhereInput | Prisma.LinkWhereInput[]
  id?: Prisma.StringFilter<'Link'> | string
  createdAt?: Prisma.DateTimeFilter<'Link'> | Date | string
  updatedAt?: Prisma.DateTimeFilter<'Link'> | Date | string
  url?: Prisma.StringFilter<'Link'> | string
  shortUrl?: Prisma.StringFilter<'Link'> | string
  userId?: Prisma.StringNullableFilter<'Link'> | string | null
  user?: Prisma.XOR<Prisma.UserNullableScalarRelationFilter, Prisma.UserWhereInput> | null
}

export type LinkOrderByWithRelationInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  url?: Prisma.SortOrder
  shortUrl?: Prisma.SortOrder
  userId?: Prisma.SortOrderInput | Prisma.SortOrder
  user?: Prisma.UserOrderByWithRelationInput
}

export type LinkWhereUniqueInput = Prisma.AtLeast<
  {
    id?: string
    AND?: Prisma.LinkWhereInput | Prisma.LinkWhereInput[]
    OR?: Prisma.LinkWhereInput[]
    NOT?: Prisma.LinkWhereInput | Prisma.LinkWhereInput[]
    createdAt?: Prisma.DateTimeFilter<'Link'> | Date | string
    updatedAt?: Prisma.DateTimeFilter<'Link'> | Date | string
    url?: Prisma.StringFilter<'Link'> | string
    shortUrl?: Prisma.StringFilter<'Link'> | string
    userId?: Prisma.StringNullableFilter<'Link'> | string | null
    user?: Prisma.XOR<Prisma.UserNullableScalarRelationFilter, Prisma.UserWhereInput> | null
  },
  'id'
>

export type LinkOrderByWithAggregationInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  url?: Prisma.SortOrder
  shortUrl?: Prisma.SortOrder
  userId?: Prisma.SortOrderInput | Prisma.SortOrder
  _count?: Prisma.LinkCountOrderByAggregateInput
  _max?: Prisma.LinkMaxOrderByAggregateInput
  _min?: Prisma.LinkMinOrderByAggregateInput
}

export type LinkScalarWhereWithAggregatesInput = {
  AND?: Prisma.LinkScalarWhereWithAggregatesInput | Prisma.LinkScalarWhereWithAggregatesInput[]
  OR?: Prisma.LinkScalarWhereWithAggregatesInput[]
  NOT?: Prisma.LinkScalarWhereWithAggregatesInput | Prisma.LinkScalarWhereWithAggregatesInput[]
  id?: Prisma.StringWithAggregatesFilter<'Link'> | string
  createdAt?: Prisma.DateTimeWithAggregatesFilter<'Link'> | Date | string
  updatedAt?: Prisma.DateTimeWithAggregatesFilter<'Link'> | Date | string
  url?: Prisma.StringWithAggregatesFilter<'Link'> | string
  shortUrl?: Prisma.StringWithAggregatesFilter<'Link'> | string
  userId?: Prisma.StringNullableWithAggregatesFilter<'Link'> | string | null
}

export type LinkCreateInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  url: string
  shortUrl: string
  user?: Prisma.UserCreateNestedOneWithoutLinksInput
}

export type LinkUncheckedCreateInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  url: string
  shortUrl: string
  userId?: string | null
}

export type LinkUpdateInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
  user?: Prisma.UserUpdateOneWithoutLinksNestedInput
}

export type LinkUncheckedUpdateInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
  userId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
}

export type LinkCreateManyInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  url: string
  shortUrl: string
  userId?: string | null
}

export type LinkUpdateManyMutationInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
}

export type LinkUncheckedUpdateManyInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
  userId?: Prisma.NullableStringFieldUpdateOperationsInput | string | null
}

export type LinkCountOrderByAggregateInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  url?: Prisma.SortOrder
  shortUrl?: Prisma.SortOrder
  userId?: Prisma.SortOrder
}

export type LinkMaxOrderByAggregateInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  url?: Prisma.SortOrder
  shortUrl?: Prisma.SortOrder
  userId?: Prisma.SortOrder
}

export type LinkMinOrderByAggregateInput = {
  id?: Prisma.SortOrder
  createdAt?: Prisma.SortOrder
  updatedAt?: Prisma.SortOrder
  url?: Prisma.SortOrder
  shortUrl?: Prisma.SortOrder
  userId?: Prisma.SortOrder
}

export type LinkListRelationFilter = {
  every?: Prisma.LinkWhereInput
  some?: Prisma.LinkWhereInput
  none?: Prisma.LinkWhereInput
}

export type LinkOrderByRelationAggregateInput = {
  _count?: Prisma.SortOrder
}

export type StringFieldUpdateOperationsInput = {
  set?: string
}

export type DateTimeFieldUpdateOperationsInput = {
  set?: Date | string
}

export type NullableStringFieldUpdateOperationsInput = {
  set?: string | null
}

export type LinkCreateNestedManyWithoutUserInput = {
  create?:
    | Prisma.XOR<Prisma.LinkCreateWithoutUserInput, Prisma.LinkUncheckedCreateWithoutUserInput>
    | Prisma.LinkCreateWithoutUserInput[]
    | Prisma.LinkUncheckedCreateWithoutUserInput[]
  connectOrCreate?: Prisma.LinkCreateOrConnectWithoutUserInput | Prisma.LinkCreateOrConnectWithoutUserInput[]
  createMany?: Prisma.LinkCreateManyUserInputEnvelope
  connect?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
}

export type LinkUncheckedCreateNestedManyWithoutUserInput = {
  create?:
    | Prisma.XOR<Prisma.LinkCreateWithoutUserInput, Prisma.LinkUncheckedCreateWithoutUserInput>
    | Prisma.LinkCreateWithoutUserInput[]
    | Prisma.LinkUncheckedCreateWithoutUserInput[]
  connectOrCreate?: Prisma.LinkCreateOrConnectWithoutUserInput | Prisma.LinkCreateOrConnectWithoutUserInput[]
  createMany?: Prisma.LinkCreateManyUserInputEnvelope
  connect?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
}

export type LinkUpdateManyWithoutUserNestedInput = {
  create?:
    | Prisma.XOR<Prisma.LinkCreateWithoutUserInput, Prisma.LinkUncheckedCreateWithoutUserInput>
    | Prisma.LinkCreateWithoutUserInput[]
    | Prisma.LinkUncheckedCreateWithoutUserInput[]
  connectOrCreate?: Prisma.LinkCreateOrConnectWithoutUserInput | Prisma.LinkCreateOrConnectWithoutUserInput[]
  upsert?: Prisma.LinkUpsertWithWhereUniqueWithoutUserInput | Prisma.LinkUpsertWithWhereUniqueWithoutUserInput[]
  createMany?: Prisma.LinkCreateManyUserInputEnvelope
  set?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  disconnect?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  delete?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  connect?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  update?: Prisma.LinkUpdateWithWhereUniqueWithoutUserInput | Prisma.LinkUpdateWithWhereUniqueWithoutUserInput[]
  updateMany?: Prisma.LinkUpdateManyWithWhereWithoutUserInput | Prisma.LinkUpdateManyWithWhereWithoutUserInput[]
  deleteMany?: Prisma.LinkScalarWhereInput | Prisma.LinkScalarWhereInput[]
}

export type LinkUncheckedUpdateManyWithoutUserNestedInput = {
  create?:
    | Prisma.XOR<Prisma.LinkCreateWithoutUserInput, Prisma.LinkUncheckedCreateWithoutUserInput>
    | Prisma.LinkCreateWithoutUserInput[]
    | Prisma.LinkUncheckedCreateWithoutUserInput[]
  connectOrCreate?: Prisma.LinkCreateOrConnectWithoutUserInput | Prisma.LinkCreateOrConnectWithoutUserInput[]
  upsert?: Prisma.LinkUpsertWithWhereUniqueWithoutUserInput | Prisma.LinkUpsertWithWhereUniqueWithoutUserInput[]
  createMany?: Prisma.LinkCreateManyUserInputEnvelope
  set?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  disconnect?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  delete?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  connect?: Prisma.LinkWhereUniqueInput | Prisma.LinkWhereUniqueInput[]
  update?: Prisma.LinkUpdateWithWhereUniqueWithoutUserInput | Prisma.LinkUpdateWithWhereUniqueWithoutUserInput[]
  updateMany?: Prisma.LinkUpdateManyWithWhereWithoutUserInput | Prisma.LinkUpdateManyWithWhereWithoutUserInput[]
  deleteMany?: Prisma.LinkScalarWhereInput | Prisma.LinkScalarWhereInput[]
}

export type LinkCreateWithoutUserInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  url: string
  shortUrl: string
}

export type LinkUncheckedCreateWithoutUserInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  url: string
  shortUrl: string
}

export type LinkCreateOrConnectWithoutUserInput = {
  where: Prisma.LinkWhereUniqueInput
  create: Prisma.XOR<Prisma.LinkCreateWithoutUserInput, Prisma.LinkUncheckedCreateWithoutUserInput>
}

export type LinkCreateManyUserInputEnvelope = {
  data: Prisma.LinkCreateManyUserInput | Prisma.LinkCreateManyUserInput[]
}

export type LinkUpsertWithWhereUniqueWithoutUserInput = {
  where: Prisma.LinkWhereUniqueInput
  update: Prisma.XOR<Prisma.LinkUpdateWithoutUserInput, Prisma.LinkUncheckedUpdateWithoutUserInput>
  create: Prisma.XOR<Prisma.LinkCreateWithoutUserInput, Prisma.LinkUncheckedCreateWithoutUserInput>
}

export type LinkUpdateWithWhereUniqueWithoutUserInput = {
  where: Prisma.LinkWhereUniqueInput
  data: Prisma.XOR<Prisma.LinkUpdateWithoutUserInput, Prisma.LinkUncheckedUpdateWithoutUserInput>
}

export type LinkUpdateManyWithWhereWithoutUserInput = {
  where: Prisma.LinkScalarWhereInput
  data: Prisma.XOR<Prisma.LinkUpdateManyMutationInput, Prisma.LinkUncheckedUpdateManyWithoutUserInput>
}

export type LinkScalarWhereInput = {
  AND?: Prisma.LinkScalarWhereInput | Prisma.LinkScalarWhereInput[]
  OR?: Prisma.LinkScalarWhereInput[]
  NOT?: Prisma.LinkScalarWhereInput | Prisma.LinkScalarWhereInput[]
  id?: Prisma.StringFilter<'Link'> | string
  createdAt?: Prisma.DateTimeFilter<'Link'> | Date | string
  updatedAt?: Prisma.DateTimeFilter<'Link'> | Date | string
  url?: Prisma.StringFilter<'Link'> | string
  shortUrl?: Prisma.StringFilter<'Link'> | string
  userId?: Prisma.StringNullableFilter<'Link'> | string | null
}

export type LinkCreateManyUserInput = {
  id?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  url: string
  shortUrl: string
}

export type LinkUpdateWithoutUserInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
}

export type LinkUncheckedUpdateWithoutUserInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
}

export type LinkUncheckedUpdateManyWithoutUserInput = {
  id?: Prisma.StringFieldUpdateOperationsInput | string
  createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string
  url?: Prisma.StringFieldUpdateOperationsInput | string
  shortUrl?: Prisma.StringFieldUpdateOperationsInput | string
}

export type LinkSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  runtime.Types.Extensions.GetSelect<
    {
      id?: boolean
      createdAt?: boolean
      updatedAt?: boolean
      url?: boolean
      shortUrl?: boolean
      userId?: boolean
      user?: boolean | Prisma.Link$userArgs<ExtArgs>
    },
    ExtArgs['result']['link']
  >

export type LinkSelectCreateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = runtime.Types.Extensions.GetSelect<
  {
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    url?: boolean
    shortUrl?: boolean
    userId?: boolean
    user?: boolean | Prisma.Link$userArgs<ExtArgs>
  },
  ExtArgs['result']['link']
>

export type LinkSelectUpdateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = runtime.Types.Extensions.GetSelect<
  {
    id?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    url?: boolean
    shortUrl?: boolean
    userId?: boolean
    user?: boolean | Prisma.Link$userArgs<ExtArgs>
  },
  ExtArgs['result']['link']
>

export type LinkSelectScalar = {
  id?: boolean
  createdAt?: boolean
  updatedAt?: boolean
  url?: boolean
  shortUrl?: boolean
  userId?: boolean
}

export type LinkOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  runtime.Types.Extensions.GetOmit<
    'id' | 'createdAt' | 'updatedAt' | 'url' | 'shortUrl' | 'userId',
    ExtArgs['result']['link']
  >
export type LinkInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  {
    user?: boolean | Prisma.Link$userArgs<ExtArgs>
  }
export type LinkIncludeCreateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  user?: boolean | Prisma.Link$userArgs<ExtArgs>
}
export type LinkIncludeUpdateManyAndReturn<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  user?: boolean | Prisma.Link$userArgs<ExtArgs>
}

export type $LinkPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> =
  {
    name: 'Link'
    objects: {
      user: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: runtime.Types.Extensions.GetPayloadResult<
      {
        id: string
        createdAt: Date
        updatedAt: Date
        url: string
        shortUrl: string
        userId: string | null
      },
      ExtArgs['result']['link']
    >
    composites: {}
  }

export type LinkGetPayload<S extends boolean | null | undefined | LinkDefaultArgs> = runtime.Types.Result.GetResult<
  Prisma.$LinkPayload,
  S
>

export type LinkCountArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = Omit<LinkFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
  select?: LinkCountAggregateInputType | true
}

export interface LinkDelegate<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
  GlobalOmitOptions = {},
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Link']; meta: { name: 'Link' } }
  /**
   * Find zero or one Link that matches the filter.
   * @param {LinkFindUniqueArgs} args - Arguments to find a Link
   * @example
   * // Get one Link
   * const link = await prisma.link.findUnique({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findUnique<T extends LinkFindUniqueArgs>(
    args: Prisma.SelectSubset<T, LinkFindUniqueArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null,
    null,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find one Link that matches the filter or throw an error with `error.code='P2025'`
   * if no matches were found.
   * @param {LinkFindUniqueOrThrowArgs} args - Arguments to find a Link
   * @example
   * // Get one Link
   * const link = await prisma.link.findUniqueOrThrow({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findUniqueOrThrow<T extends LinkFindUniqueOrThrowArgs>(
    args: Prisma.SelectSubset<T, LinkFindUniqueOrThrowArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find the first Link that matches the filter.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkFindFirstArgs} args - Arguments to find a Link
   * @example
   * // Get one Link
   * const link = await prisma.link.findFirst({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findFirst<T extends LinkFindFirstArgs>(
    args?: Prisma.SelectSubset<T, LinkFindFirstArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null,
    null,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find the first Link that matches the filter or
   * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkFindFirstOrThrowArgs} args - Arguments to find a Link
   * @example
   * // Get one Link
   * const link = await prisma.link.findFirstOrThrow({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   */
  findFirstOrThrow<T extends LinkFindFirstOrThrowArgs>(
    args?: Prisma.SelectSubset<T, LinkFindFirstOrThrowArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Find zero or more Links that matches the filter.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkFindManyArgs} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Links
   * const links = await prisma.link.findMany()
   *
   * // Get first 10 Links
   * const links = await prisma.link.findMany({ take: 10 })
   *
   * // Only select the `id`
   * const linkWithIdOnly = await prisma.link.findMany({ select: { id: true } })
   *
   */
  findMany<T extends LinkFindManyArgs>(
    args?: Prisma.SelectSubset<T, LinkFindManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>
  >

  /**
   * Create a Link.
   * @param {LinkCreateArgs} args - Arguments to create a Link.
   * @example
   * // Create one Link
   * const Link = await prisma.link.create({
   *   data: {
   *     // ... data to create a Link
   *   }
   * })
   *
   */
  create<T extends LinkCreateArgs>(
    args: Prisma.SelectSubset<T, LinkCreateArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'create', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Create many Links.
   * @param {LinkCreateManyArgs} args - Arguments to create many Links.
   * @example
   * // Create many Links
   * const link = await prisma.link.createMany({
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   *
   */
  createMany<T extends LinkCreateManyArgs>(
    args?: Prisma.SelectSubset<T, LinkCreateManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<Prisma.BatchPayload>

  /**
   * Create many Links and returns the data saved in the database.
   * @param {LinkCreateManyAndReturnArgs} args - Arguments to create many Links.
   * @example
   * // Create many Links
   * const link = await prisma.link.createManyAndReturn({
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   *
   * // Create many Links and only return the `id`
   * const linkWithIdOnly = await prisma.link.createManyAndReturn({
   *   select: { id: true },
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   *
   */
  createManyAndReturn<T extends LinkCreateManyAndReturnArgs>(
    args?: Prisma.SelectSubset<T, LinkCreateManyAndReturnArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>
  >

  /**
   * Delete a Link.
   * @param {LinkDeleteArgs} args - Arguments to delete one Link.
   * @example
   * // Delete one Link
   * const Link = await prisma.link.delete({
   *   where: {
   *     // ... filter to delete one Link
   *   }
   * })
   *
   */
  delete<T extends LinkDeleteArgs>(
    args: Prisma.SelectSubset<T, LinkDeleteArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Update one Link.
   * @param {LinkUpdateArgs} args - Arguments to update one Link.
   * @example
   * // Update one Link
   * const link = await prisma.link.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   *
   */
  update<T extends LinkUpdateArgs>(
    args: Prisma.SelectSubset<T, LinkUpdateArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'update', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Delete zero or more Links.
   * @param {LinkDeleteManyArgs} args - Arguments to filter Links to delete.
   * @example
   * // Delete a few Links
   * const { count } = await prisma.link.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   *
   */
  deleteMany<T extends LinkDeleteManyArgs>(
    args?: Prisma.SelectSubset<T, LinkDeleteManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<Prisma.BatchPayload>

  /**
   * Update zero or more Links.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Links
   * const link = await prisma.link.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   *
   */
  updateMany<T extends LinkUpdateManyArgs>(
    args: Prisma.SelectSubset<T, LinkUpdateManyArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<Prisma.BatchPayload>

  /**
   * Update zero or more Links and returns the data updated in the database.
   * @param {LinkUpdateManyAndReturnArgs} args - Arguments to update many Links.
   * @example
   * // Update many Links
   * const link = await prisma.link.updateManyAndReturn({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: [
   *     // ... provide data here
   *   ]
   * })
   *
   * // Update zero or more Links and only return the `id`
   * const linkWithIdOnly = await prisma.link.updateManyAndReturn({
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
  updateManyAndReturn<T extends LinkUpdateManyAndReturnArgs>(
    args: Prisma.SelectSubset<T, LinkUpdateManyAndReturnArgs<ExtArgs>>,
  ): Prisma.PrismaPromise<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>
  >

  /**
   * Create or update one Link.
   * @param {LinkUpsertArgs} args - Arguments to update or create a Link.
   * @example
   * // Update or create a Link
   * const link = await prisma.link.upsert({
   *   create: {
   *     // ... data to create a Link
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Link we want to update
   *   }
   * })
   */
  upsert<T extends LinkUpsertArgs>(
    args: Prisma.SelectSubset<T, LinkUpsertArgs<ExtArgs>>,
  ): Prisma.Prisma__LinkClient<
    runtime.Types.Result.GetResult<Prisma.$LinkPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>,
    never,
    ExtArgs,
    GlobalOmitOptions
  >

  /**
   * Count the number of Links.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkCountArgs} args - Arguments to filter Links to count.
   * @example
   * // Count the number of Links
   * const count = await prisma.link.count({
   *   where: {
   *     // ... the filter for the Links we want to count
   *   }
   * })
   **/
  count<T extends LinkCountArgs>(
    args?: Prisma.Subset<T, LinkCountArgs>,
  ): Prisma.PrismaPromise<
    T extends runtime.Types.Utils.Record<'select', any>
      ? T['select'] extends true
        ? number
        : Prisma.GetScalarType<T['select'], LinkCountAggregateOutputType>
      : number
  >

  /**
   * Allows you to perform aggregations operations on a Link.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
  aggregate<T extends LinkAggregateArgs>(
    args: Prisma.Subset<T, LinkAggregateArgs>,
  ): Prisma.PrismaPromise<GetLinkAggregateType<T>>

  /**
   * Group by Link.
   * Note, that providing `undefined` is treated as the value not being there.
   * Read more here: https://pris.ly/d/null-undefined
   * @param {LinkGroupByArgs} args - Group by arguments.
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
    T extends LinkGroupByArgs,
    HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>,
    OrderByArg extends Prisma.True extends HasSelectOrTake
      ? { orderBy: LinkGroupByArgs['orderBy'] }
      : { orderBy?: LinkGroupByArgs['orderBy'] },
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
    args: Prisma.SubsetIntersection<T, LinkGroupByArgs, OrderByArg> & InputErrors,
  ): {} extends InputErrors ? GetLinkGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Link model
   */
  readonly fields: LinkFieldRefs
}

/**
 * The delegate class that acts as a "Promise-like" for Link.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__LinkClient<
  T,
  Null = never,
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
  GlobalOmitOptions = {},
> extends Prisma.PrismaPromise<T> {
  readonly [Symbol.toStringTag]: 'PrismaPromise'
  user<T extends Prisma.Link$userArgs<ExtArgs> = {}>(
    args?: Prisma.Subset<T, Prisma.Link$userArgs<ExtArgs>>,
  ): Prisma.Prisma__UserClient<
    runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions> | null,
    null,
    ExtArgs,
    GlobalOmitOptions
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
 * Fields of the Link model
 */
export interface LinkFieldRefs {
  readonly id: Prisma.FieldRef<'Link', 'String'>
  readonly createdAt: Prisma.FieldRef<'Link', 'DateTime'>
  readonly updatedAt: Prisma.FieldRef<'Link', 'DateTime'>
  readonly url: Prisma.FieldRef<'Link', 'String'>
  readonly shortUrl: Prisma.FieldRef<'Link', 'String'>
  readonly userId: Prisma.FieldRef<'Link', 'String'>
}

// Custom InputTypes
/**
 * Link findUnique
 */
export type LinkFindUniqueArgs<
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
  /**
   * Filter, which Link to fetch.
   */
  where: Prisma.LinkWhereUniqueInput
}

/**
 * Link findUniqueOrThrow
 */
export type LinkFindUniqueOrThrowArgs<
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
  /**
   * Filter, which Link to fetch.
   */
  where: Prisma.LinkWhereUniqueInput
}

/**
 * Link findFirst
 */
export type LinkFindFirstArgs<
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
  /**
   * Filter, which Link to fetch.
   */
  where?: Prisma.LinkWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Links to fetch.
   */
  orderBy?: Prisma.LinkOrderByWithRelationInput | Prisma.LinkOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the position for searching for Links.
   */
  cursor?: Prisma.LinkWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Links from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Links.
   */
  skip?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
   *
   * Filter by unique combinations of Links.
   */
  distinct?: Prisma.LinkScalarFieldEnum | Prisma.LinkScalarFieldEnum[]
}

/**
 * Link findFirstOrThrow
 */
export type LinkFindFirstOrThrowArgs<
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
  /**
   * Filter, which Link to fetch.
   */
  where?: Prisma.LinkWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Links to fetch.
   */
  orderBy?: Prisma.LinkOrderByWithRelationInput | Prisma.LinkOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the position for searching for Links.
   */
  cursor?: Prisma.LinkWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Links from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Links.
   */
  skip?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
   *
   * Filter by unique combinations of Links.
   */
  distinct?: Prisma.LinkScalarFieldEnum | Prisma.LinkScalarFieldEnum[]
}

/**
 * Link findMany
 */
export type LinkFindManyArgs<
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
  /**
   * Filter, which Links to fetch.
   */
  where?: Prisma.LinkWhereInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
   *
   * Determine the order of Links to fetch.
   */
  orderBy?: Prisma.LinkOrderByWithRelationInput | Prisma.LinkOrderByWithRelationInput[]
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
   *
   * Sets the position for listing Links.
   */
  cursor?: Prisma.LinkWhereUniqueInput
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Take `±n` Links from the position of the cursor.
   */
  take?: number
  /**
   * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
   *
   * Skip the first `n` Links.
   */
  skip?: number
  distinct?: Prisma.LinkScalarFieldEnum | Prisma.LinkScalarFieldEnum[]
}

/**
 * Link create
 */
export type LinkCreateArgs<
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
  /**
   * The data needed to create a Link.
   */
  data: Prisma.XOR<Prisma.LinkCreateInput, Prisma.LinkUncheckedCreateInput>
}

/**
 * Link createMany
 */
export type LinkCreateManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * The data used to create many Links.
   */
  data: Prisma.LinkCreateManyInput | Prisma.LinkCreateManyInput[]
}

/**
 * Link createManyAndReturn
 */
export type LinkCreateManyAndReturnArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the Link
   */
  select?: Prisma.LinkSelectCreateManyAndReturn<ExtArgs> | null
  /**
   * Omit specific fields from the Link
   */
  omit?: Prisma.LinkOmit<ExtArgs> | null
  /**
   * The data used to create many Links.
   */
  data: Prisma.LinkCreateManyInput | Prisma.LinkCreateManyInput[]
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.LinkIncludeCreateManyAndReturn<ExtArgs> | null
}

/**
 * Link update
 */
export type LinkUpdateArgs<
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
  /**
   * The data needed to update a Link.
   */
  data: Prisma.XOR<Prisma.LinkUpdateInput, Prisma.LinkUncheckedUpdateInput>
  /**
   * Choose, which Link to update.
   */
  where: Prisma.LinkWhereUniqueInput
}

/**
 * Link updateMany
 */
export type LinkUpdateManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * The data used to update Links.
   */
  data: Prisma.XOR<Prisma.LinkUpdateManyMutationInput, Prisma.LinkUncheckedUpdateManyInput>
  /**
   * Filter which Links to update
   */
  where?: Prisma.LinkWhereInput
  /**
   * Limit how many Links to update.
   */
  limit?: number
}

/**
 * Link updateManyAndReturn
 */
export type LinkUpdateManyAndReturnArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Select specific fields to fetch from the Link
   */
  select?: Prisma.LinkSelectUpdateManyAndReturn<ExtArgs> | null
  /**
   * Omit specific fields from the Link
   */
  omit?: Prisma.LinkOmit<ExtArgs> | null
  /**
   * The data used to update Links.
   */
  data: Prisma.XOR<Prisma.LinkUpdateManyMutationInput, Prisma.LinkUncheckedUpdateManyInput>
  /**
   * Filter which Links to update
   */
  where?: Prisma.LinkWhereInput
  /**
   * Limit how many Links to update.
   */
  limit?: number
  /**
   * Choose, which related nodes to fetch as well
   */
  include?: Prisma.LinkIncludeUpdateManyAndReturn<ExtArgs> | null
}

/**
 * Link upsert
 */
export type LinkUpsertArgs<
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
  /**
   * The filter to search for the Link to update in case it exists.
   */
  where: Prisma.LinkWhereUniqueInput
  /**
   * In case the Link found by the `where` argument doesn't exist, create a new Link with this data.
   */
  create: Prisma.XOR<Prisma.LinkCreateInput, Prisma.LinkUncheckedCreateInput>
  /**
   * In case the Link was found with the provided `where` argument, update it with this data.
   */
  update: Prisma.XOR<Prisma.LinkUpdateInput, Prisma.LinkUncheckedUpdateInput>
}

/**
 * Link delete
 */
export type LinkDeleteArgs<
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
  /**
   * Filter which Link to delete.
   */
  where: Prisma.LinkWhereUniqueInput
}

/**
 * Link deleteMany
 */
export type LinkDeleteManyArgs<
  ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs,
> = {
  /**
   * Filter which Links to delete
   */
  where?: Prisma.LinkWhereInput
  /**
   * Limit how many Links to delete.
   */
  limit?: number
}

/**
 * Link.user
 */
export type Link$userArgs<
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
  where?: Prisma.UserWhereInput
}

/**
 * Link without action
 */
export type LinkDefaultArgs<
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
}
