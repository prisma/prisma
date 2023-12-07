import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  // @ts-expect-error
  prisma.$on('beforeExit', () => {})
}

void main()
