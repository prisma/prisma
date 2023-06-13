import { Prisma } from '@prisma/client/extension'

export const simpleExtension = Prisma.defineExtension({
  model: {
    $allModels: {
      simpleCall<T, A>(this: T, _args: Prisma.Exact<A, Prisma.Args<T, 'findFirst'>>) {
        return {} as Prisma.Result<T, A, 'findFirst'>
      },
    },
  },
})
