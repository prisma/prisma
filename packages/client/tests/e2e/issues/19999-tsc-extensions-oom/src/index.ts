import { Prisma, PrismaClient } from '@prisma/client'

const ext = Prisma.defineExtension((client) => {
  return client.$extends({
    model: {
      $allModels: {
        paginate<T, A>(this: T, _: Prisma.Exact<A, Prisma.Args<T, 'findMany'>>) {
          return {} as Prisma.Result<T, A, 'findMany'> & { prop: string }
        },
      },
    },
  })
})

const xprismaViaDefinedExt = new PrismaClient().$extends(ext)
const xprismaViaInlineExt = new PrismaClient().$extends({
  model: {
    $allModels: {
      paginate<T, A>(this: T, _: Prisma.Exact<A, Prisma.Args<T, 'findMany'>>) {
        return {} as Prisma.Result<T, A, 'findMany'> & { prop: string }
      },
    },
  },
})

export { ext, xprismaViaDefinedExt, xprismaViaInlineExt }
