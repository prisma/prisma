import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  prisma.$on('beforeExit', () => {})
}

void main()
