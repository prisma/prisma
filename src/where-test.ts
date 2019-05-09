// type UserWhereInput = {
//   AND: UserWhereInput
//   id: string
//   id_not: string
//   id_in: string[]
//   id_not_in: string[]
//   id_lt: string
//   id_lte: string
//   id_gt: string
//   id_gte: string
//   id_contains: string
//   id_not_contains: string
//   id_starts_with: string
//   id_not_starts_with: string
//   id_ends_with: string
//   id_not_ends_with: string
//   name: string
//   name_not: string
//   name_in: string[]
//   name_not_in: string[]
//   name_lt: string
//   name_lte: string
//   name_gt: string
//   name_gte: string
//   name_contains: string
//   name_not_contains: string
//   name_starts_with: string
//   name_not_starts_with: string
//   name_ends_with: string
//   name_not_ends_with: string
// }

// type UserWhereInput2 = {
//   AND: UserWhereInput
//   id: StringFilter
//   name: StringFilter
// }

// type StringFilter = {
//   in: string[]
//   lt: string
//   lte: string
//   gt: string
//   gte: string
//   contains: string
//   startsWith: string
//   endsWith: string
//   not: StringFilter
// }

// type UserArgs = {
//   where: UserWhereInput
// }

// interface Prisma {
//   users(args: UserArgs): Promise<any>
// }

// const prisma: Prisma = null as any

// prisma.users({
//   where: {
//     id_,
//   },
// })
