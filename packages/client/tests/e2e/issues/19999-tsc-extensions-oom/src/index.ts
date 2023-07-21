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

export class NestJSWrapper {
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

export { ext, xprismaViaDefinedExt, xprismaViaInlineExt }
