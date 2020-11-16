class Prisma {
  users = {
    findUnique() {},
  }
}

class UsersFindOne {}

interface InstructionsOptions {
  instructions: object[]
}

class Executable {
  instructions: object[]
  constructor({ instructions }: InstructionsOptions) {
    this.instructions = instructions
  }
  then() {}
  catch() {}
}
