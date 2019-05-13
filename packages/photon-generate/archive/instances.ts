prisma.users
  .findOne()
  .posts()
  .title()

class PrismaC {
  instructions: string[]
  constructor(instructions?: string[]) {
    if (instructions) {
      this.instructions = instructions
    }
  }
  users = {
    findOne() {
      if (this.instructions) {
        return this
      }
      const instance = new PrismaC(['users.findOne'])
    },
  }
}

const postsPointer = prisma.users.findOne().posts()
const titlePointer = postsPointer.title()

await Promise.all(postsPointer, titlePointer)
