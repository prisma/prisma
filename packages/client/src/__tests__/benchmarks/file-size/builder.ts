import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../utils/getTestClient'

function write(location: string, data: string) {
  if (fs.existsSync(location)) {
    fs.unlinkSync(location)
  }
  fs.writeFileSync(location, data, {})
}

export async function setup(engineType: ClientEngineType) {
  const schema = renderSchema(engineType)
  const schemaPath = path.join(__dirname, 'schema.prisma')

  write(schemaPath, schema)
  await generateTestClient(__dirname)
}

function renderSchema(engineType: ClientEngineType): string {
  return `\
  generator client {
    provider   = "prisma-client-js"
    engineType = "${engineType}"
  }
  
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  
  model Bench {
    id Int @id
  }
  `
}
