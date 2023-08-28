import { Prisma, PrismaClient } from '@prisma/client'

export const extension = Prisma.defineExtension((client) => {
  return client.$extends({
    model: {
      $allModels: {
        someOperation<T, A>(this: T, _: Prisma.Exact<A, Prisma.Args<T, 'findMany'>>) {
          return {} as Prisma.Result<T, A, 'findMany'> & { prop: string }
        },
      },
    },
  })
})

export const xprismaViaDefinedExt = new PrismaClient().$extends(extension)

export const xprismaViaInlineExt = new PrismaClient().$extends({
  model: {
    $allModels: {
      someOperation<T, A>(this: T, _: Prisma.Exact<A, Prisma.Args<T, 'findMany'>>) {
        return {} as Prisma.Result<T, A, 'findMany'> & { prop: string }
      },
    },
  },
})

export class SomeClassWrapper {
  // eg. NestJS
  constructor(private readonly prismaService: PrismaClient) {}

  findMany<T extends Prisma.ModelAFindManyArgs>(findManyDto: Prisma.SelectSubset<T, Prisma.ModelAFindManyArgs>) {
    return this.prismaService.modelA.findMany(findManyDto)
  }

  findFirst(findFirstDto: Prisma.ModelAFindFirstArgs) {
    return this.prismaService.modelA.findFirst(findFirstDto)
  }

  create(createDto: Prisma.ModelACreateArgs) {
    this.prismaService.modelA.create(createDto)
  }

  update(updateDto: Prisma.ModelAUpdateArgs) {
    this.prismaService.modelA.update(updateDto)
  }

  delete(deleteDto: Prisma.ModelADeleteArgs) {
    this.prismaService.modelA.delete(deleteDto)
  }
}

export function someFunction(data: Prisma.Args<typeof xprismaViaInlineExt.modelA, 'create'>['data']) {
  return xprismaViaInlineExt.modelA.create({ data })
}

// from https://github.com/prisma/prisma/issues/20243
export type StripePriceUpsert = Omit<Prisma.ModelAUpsertArgs, 'create' | 'update'> & {
  create: Prisma.ModelAUncheckedCreateInput
  update: Prisma.ModelAUncheckedUpdateInput
}

export const upsertPromise = new PrismaClient().$extends({}).modelA.upsert({} as any as StripePriceUpsert)
