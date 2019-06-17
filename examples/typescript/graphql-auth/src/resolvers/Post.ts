import { prismaObjectType } from 'nexus-prisma'

export const Post = prismaObjectType({
  name: 'Post',
  definition(t) {
    t.prismaFields(['*'])
  },
})
