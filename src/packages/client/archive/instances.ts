prisma.users.findUnique().posts().title()

class PrismaC {
  instructions: string[]
  constructor(instructions?: string[]) {
    if (instructions) {
      this.instructions = instructions
    }
  }
  users = {
    findUnique() {
      if (this.instructions) {
        return this
      }
      const instance = new PrismaC(['users.findUnique'])
    },
  }
}

const postsPointer = prisma.users.findUnique().posts()
const titlePointer = postsPointer.title()

await Promise.all(postsPointer, titlePointer)
