import { PrismaClient } from '@prisma/client'
import fs from 'fs'

async function main() {
  const prisma = new PrismaClient()

  const script = fs.readFileSync('./src/init.sql', 'utf-8')

  for (const stmt of script.split(';')) {
    if (!stmt.trim()) continue // Skip empty statements
    await prisma.$executeRawUnsafe(stmt.trim())
  }
}

void main()
