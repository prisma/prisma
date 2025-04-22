/**
 * This file exports various common sort, input & filter types that are not directly linked to a particular model.
 *
 * 🟢 You can import this file directly.
 */

import * as runtime from '@prisma/client/runtime/library'
import type * as Prisma from './internal/prismaNamespace.js'

export interface StringFilter<$PrismaModel = never, AdditionalValue = never> {
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>
  equals?: Prisma.StringFieldRefInput<$PrismaModel> | string | AdditionalValue
  in?: string[] | AdditionalValue
  notIn?: string[] | AdditionalValue
  not?: Prisma.NestedStringFilter<$PrismaModel, AdditionalValue> | string | AdditionalValue
}

export interface StringNullableFilter<$PrismaModel = never> extends StringFilter<$PrismaModel, null> {}

export interface StringWithAggregatesFilter<$PrismaModel = never, AdditionalValue = never>
  extends StringFilter<$PrismaModel, AdditionalValue> {
  _count?: Prisma.NestedIntFilter<$PrismaModel>
  _min?: Prisma.NestedStringFilter<$PrismaModel>
  _max?: Prisma.NestedStringFilter<$PrismaModel>
}

export interface StringNullableWithAggregatesFilter<$PrismaModel = never>
  extends StringWithAggregatesFilter<$PrismaModel, null> {}

export interface NestedStringFilter<$PrismaModel = never, AdditionalValue = never>
  extends StringFilter<$PrismaModel, AdditionalValue> {}

export interface NestedStringWithAggregatesFilter<$PrismaModel = never>
  extends StringWithAggregatesFilter<$PrismaModel> {}

export interface NestedStringNullableFilter<$PrismaModel = never> extends StringNullableFilter<$PrismaModel> {}

export interface NestedStringNullableWithAggregatesFilter<$PrismaModel = never>
  extends StringNullableWithAggregatesFilter<$PrismaModel> {}

export interface DateTimeFilter<$PrismaModel = never, AdditionalValue = never> {
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel> | AdditionalValue
  in?: Date[] | string[] | AdditionalValue
  notIn?: Date[] | string[] | AdditionalValue
  not?: Prisma.NestedDateTimeFilter<$PrismaModel, AdditionalValue> | Date | string | AdditionalValue
}

export interface DateTimeNullableFilter<$PrismaModel = never> extends DateTimeFilter<$PrismaModel, null> {}

export interface DateTimeAggregatesFilter<$PrismaModel = never, AdditionalValue = never>
  extends DateTimeFilter<$PrismaModel, AdditionalValue> {
  _count?: Prisma.NestedIntFilter<$PrismaModel, AdditionalValue>
  _min?: Prisma.NestedDateTimeFilter<$PrismaModel, AdditionalValue>
  _max?: Prisma.NestedDateTimeFilter<$PrismaModel, AdditionalValue>
}

export interface DateTimeNullableWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeAggregatesFilter<$PrismaModel, null> {}

export interface NestedDateTimeFilter<$PrismaModel = never, AdditionalValue = never>
  extends DateTimeFilter<$PrismaModel, AdditionalValue> {}

export interface NestedDateTimeWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeAggregatesFilter<$PrismaModel> {}

export interface NestedDateTimeNullableFilter<$PrismaModel = never> extends DateTimeNullableFilter<$PrismaModel> {}

export interface NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeNullableWithAggregatesFilter<$PrismaModel> {}

export interface SortOrderInput {
  sort: Prisma.SortOrder
  nulls?: Prisma.NullsOrder
}

export interface IntFilter<$PrismaModel = never, AdditionalValue = never> {
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel> | AdditionalValue
  in?: number[] | AdditionalValue
  notIn?: number[] | AdditionalValue
  not?: Prisma.NestedIntFilter<$PrismaModel, AdditionalValue> | number | AdditionalValue
}

export interface NestedIntFilter<$PrismaModel = never, AdditionalValue = never>
  extends IntFilter<$PrismaModel, AdditionalValue> {}

export interface IntNullableFilter<$PrismaModel = never> extends IntFilter<$PrismaModel, null> {}

export interface NestedIntNullableFilter<$PrismaModel = never> extends IntNullableFilter<$PrismaModel> {}

type DistributedArray<T> = T extends unknown ? T[] : never

interface BaseFilter<T, Ref, AdditionalValue> {
  lt?: T | Ref
  lte?: T | Ref
  gt?: T | Ref
  gte?: T | Ref
  equals?: T | Ref | AdditionalValue
  in?: DistributedArray<T> | AdditionalValue
  notIn?: DistributedArray<T> | AdditionalValue
  not?: this | T | AdditionalValue
}

export interface DecimalFilter<$PrismaModel = never, AdditionalValue = never>
  extends BaseFilter<
    runtime.Decimal | runtime.DecimalJsLike | number | string,
    Prisma.DecimalFieldRefInput<$PrismaModel>,
    AdditionalValue
  > {}

export interface DecimalNullableFilter<$PrismaModel = never> extends DecimalFilter<$PrismaModel, null> {}

export interface NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> {
  equals?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel> | null
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  lt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  lte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  not?:
    | Prisma.NestedDecimalNullableWithAggregatesFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>
  _avg?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
  _sum?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
  _min?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
  _max?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
}

export interface DecimalNullableWithAggregatesFilter<$PrismaModel = never> {
  equals?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel> | null
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  lt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  lte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  not?:
    | Prisma.NestedDecimalNullableWithAggregatesFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
  _count?: Prisma.NestedIntNullableFilter<$PrismaModel>
  _avg?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
  _sum?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
  _min?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
  _max?: Prisma.NestedDecimalNullableFilter<$PrismaModel>
}
