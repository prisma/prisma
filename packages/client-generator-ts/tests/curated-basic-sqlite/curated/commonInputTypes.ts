/**
 * This file exports various common sort, input & filter types that are not directly linked to a particular model.
 *
 * 🟢 You can import this file directly.
 */

import * as runtime from '@prisma/client/runtime/library'
import type * as Prisma from './internal/prismaNamespace.js'

export interface StringBaseFilter<$PrismaModel = never> {
  lt?: string | Prisma.StringFieldRefInput<$PrismaModel>
  lte?: string | Prisma.StringFieldRefInput<$PrismaModel>
  gt?: string | Prisma.StringFieldRefInput<$PrismaModel>
  gte?: string | Prisma.StringFieldRefInput<$PrismaModel>
  contains?: string | Prisma.StringFieldRefInput<$PrismaModel>
  startsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>
  endsWith?: string | Prisma.StringFieldRefInput<$PrismaModel>
}

export interface StringNullableFilter<$PrismaModel = never> extends StringBaseFilter<$PrismaModel> {
  equals?: string | Prisma.StringFieldRefInput<$PrismaModel> | null
  in?: string[] | null
  notIn?: string[] | null
  not?: Prisma.NestedStringNullableFilter<$PrismaModel> | string | null
}

export interface StringFilter<$PrismaModel = never> extends StringBaseFilter<$PrismaModel> {
  equals?: Prisma.StringFieldRefInput<$PrismaModel> | string
  in?: string[]
  notIn?: string[]
  not?: Prisma.NestedStringFilter<$PrismaModel> | string
}

export interface StringAggregateFilterProps<$PrismaModel = never> {
  _count?: Prisma.NestedIntFilter<$PrismaModel>
  _min?: Prisma.NestedStringFilter<$PrismaModel>
  _max?: Prisma.NestedStringFilter<$PrismaModel>
}

export interface StringWithAggregatesFilter<$PrismaModel = never>
  extends StringFilter<$PrismaModel>,
    StringAggregateFilterProps<$PrismaModel> {}

export interface StringNullableWithAggregatesFilter<$PrismaModel = never>
  extends StringNullableFilter<$PrismaModel>,
    StringAggregateFilterProps<$PrismaModel> {}

export interface NestedStringFilter<$PrismaModel = never> extends StringFilter<$PrismaModel> {}

export interface NestedStringWithAggregatesFilter<$PrismaModel = never>
  extends StringWithAggregatesFilter<$PrismaModel> {}

export interface NestedStringNullableFilter<$PrismaModel = never> extends StringNullableFilter<$PrismaModel> {}

export interface NestedStringNullableWithAggregatesFilter<$PrismaModel = never>
  extends StringNullableWithAggregatesFilter<$PrismaModel> {}

export interface DateTimeBaseFilter<$PrismaModel = never> {
  lt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  lte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  gt?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  gte?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
}

export interface DateTimeFilter<$PrismaModel = never> extends DateTimeBaseFilter<$PrismaModel> {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel>
  in?: Date[] | string[]
  notIn?: Date[] | string[]
  not?: Prisma.NestedDateTimeFilter<$PrismaModel> | Date | string
}

export interface DateTimeNullableFilter<$PrismaModel = never> extends DateTimeBaseFilter<$PrismaModel> {
  equals?: Date | string | Prisma.DateTimeFieldRefInput<$PrismaModel> | null
  in?: Date[] | string[] | null
  notIn?: Date[] | string[] | null
  not?: Prisma.NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
}

export interface DateTimeAggregatesFilterProps<$PrismaModel = never> {
  _count?: Prisma.NestedIntFilter<$PrismaModel>
  _min?: Prisma.NestedDateTimeFilter<$PrismaModel>
  _max?: Prisma.NestedDateTimeFilter<$PrismaModel>
}

export interface DateTimeNullableWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeNullableFilter<$PrismaModel>,
    DateTimeAggregatesFilterProps<$PrismaModel> {}

export interface NestedDateTimeFilter<$PrismaModel = never> extends DateTimeFilter<$PrismaModel> {}

export interface NestedDateTimeWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeFilter<$PrismaModel>,
    DateTimeAggregatesFilterProps<$PrismaModel> {}

export interface NestedDateTimeNullableFilter<$PrismaModel = never> extends DateTimeNullableFilter<$PrismaModel> {}

export interface NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never>
  extends DateTimeNullableWithAggregatesFilter<$PrismaModel> {}

export interface SortOrderInput {
  sort: Prisma.SortOrder
  nulls?: Prisma.NullsOrder
}

export interface IntBaseFilter<$PrismaModel = never> {
  lt?: number | Prisma.IntFieldRefInput<$PrismaModel>
  lte?: number | Prisma.IntFieldRefInput<$PrismaModel>
  gt?: number | Prisma.IntFieldRefInput<$PrismaModel>
  gte?: number | Prisma.IntFieldRefInput<$PrismaModel>
}

export interface IntFilter<$PrismaModel = never> extends IntBaseFilter<$PrismaModel> {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel>
  in?: number[]
  notIn?: number[]
  not?: Prisma.NestedIntFilter<$PrismaModel> | number
}

export interface NestedIntFilter<$PrismaModel = never> extends IntFilter<$PrismaModel> {}

export interface IntNullableFilter<$PrismaModel = never> extends IntBaseFilter<$PrismaModel> {
  equals?: number | Prisma.IntFieldRefInput<$PrismaModel> | null
  in?: number[] | null
  notIn?: number[] | null
  not?: Prisma.NestedIntNullableFilter<$PrismaModel> | number | null
}

export interface NestedIntNullableFilter<$PrismaModel = never> extends IntNullableFilter<$PrismaModel> {}

export interface DecimalNullableFilter<$PrismaModel = never> {
  equals?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel> | null
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  lt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  lte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  not?:
    | Prisma.NestedDecimalNullableFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

export interface NestedDecimalNullableFilter<$PrismaModel = never> {
  equals?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel> | null
  in?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  notIn?: runtime.Decimal[] | runtime.DecimalJsLike[] | number[] | string[] | null
  lt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  lte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gt?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  gte?: runtime.Decimal | runtime.DecimalJsLike | number | string | Prisma.DecimalFieldRefInput<$PrismaModel>
  not?:
    | Prisma.NestedDecimalNullableFilter<$PrismaModel>
    | runtime.Decimal
    | runtime.DecimalJsLike
    | number
    | string
    | null
}

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
