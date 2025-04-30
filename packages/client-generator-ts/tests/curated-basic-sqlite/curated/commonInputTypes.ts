/**
 * This file exports various common sort, input & filter types that are not directly linked to a particular model.
 *
 * 🟢 You can import this file directly.
 */

import * as runtime from '@prisma/client/runtime/library'
import type * as Prisma from './internal/prismaNamespace.js'

type DistributedArray<T> = T extends unknown ? T[] : never

// ssalbdivad-example-1:
// - interface extension
// - DRY structures

interface BaseFilter<T, Ref, Null> {
  lt?: T | Ref
  lte?: T | Ref
  gt?: T | Ref
  gte?: T | Ref
  equals?: T | Ref | Null
  in?: DistributedArray<T> | Null
  notIn?: DistributedArray<T> | Null
  not?: this | T | Null
}

interface BaseAggregateProps<Model, Null> {
  _count?: Prisma.IntFilter<Model, Null>
  _min?: this
  _max?: this
}

export interface StringFilter<$PrismaModel = never, Null = never>
  extends BaseFilter<string, Prisma.StringFieldRefInput<$PrismaModel>, Null> {}

export interface StringNullableFilter<$PrismaModel = never> extends StringFilter<$PrismaModel, null> {}

export interface StringWithAggregatesFilter<$PrismaModel = never, Null = never>
  extends StringFilter<$PrismaModel, Null>,
    BaseAggregateProps<$PrismaModel, Null> {}

export interface StringNullableWithAggregatesFilter<$PrismaModel = never>
  extends StringWithAggregatesFilter<$PrismaModel, null> {}

export interface DateTimeFilter<$PrismaModel = never, Null = never>
  extends BaseFilter<Date | string, Prisma.DateTimeFieldRefInput<$PrismaModel>, Null> {}

export interface DateTimeNullableFilter<$PrismaModel = never> extends DateTimeFilter<$PrismaModel, null> {}

export interface DateTimeWithAggregatesFilter<$PrismaModel = never, Null = never>
  extends DateTimeFilter<$PrismaModel, Null>,
    BaseAggregateProps<$PrismaModel, Null> {}

export interface DateTimeNullableWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeWithAggregatesFilter<$PrismaModel, null> {}

export interface SortOrderInput {
  sort: Prisma.SortOrder
  nulls?: Prisma.NullsOrder
}

export interface IntFilter<$PrismaModel = never, Null = never>
  extends BaseFilter<number, Prisma.IntFieldRefInput<$PrismaModel>, Null> {}

export interface IntNullableFilter<$PrismaModel = never> extends IntFilter<$PrismaModel, null> {}

export interface DecimalFilter<$PrismaModel = never, Null = never>
  extends BaseFilter<
    runtime.Decimal | runtime.DecimalJsLike | number | string,
    Prisma.DecimalFieldRefInput<$PrismaModel>,
    Null
  > {}

export interface DecimalNullableFilter<$PrismaModel = never> extends DecimalFilter<$PrismaModel, null> {}

export interface DecimalNullableWithAggregatesFilter<$PrismaModel = never>
  extends DecimalFilter<$PrismaModel, null>,
    BaseAggregateProps<$PrismaModel, null> {
  _avg?: Prisma.DecimalNullableFilter<$PrismaModel>
  _sum?: Prisma.DecimalNullableFilter<$PrismaModel>
}
