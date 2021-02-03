// This file is used to build large schemas for benchmarking purposes

import fs from 'fs'
import path from 'path'

const numberToBase26 = (val: number, tail = '') => {
  if (val <= 26) {
    return `${String.fromCharCode(val + 64)}${tail}`
  }

  const remainder = val % 26 || 26
  const division = Math.trunc(val / 26) - (remainder === 26 ? 1 : 0)

  return numberToBase26(
    division,
    `${String.fromCharCode(remainder + 64)}${tail}`,
  )
}

function write(location: string, data: string) {
  if (fs.existsSync(location)) {
    fs.unlinkSync(location)
  }
  fs.writeFileSync(location, data, {})
}

class Model {
  name: string
  body: string
  constructor({ name, body }: { name: string; body?: string }) {
    this.name = name
    this.body = body ?? ``
  }
  public build() {
    return `
model ${this.name} {
  ${this.body}
}
`
  }
}

async function main() {
  let schema = `
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["nativeTypes", "groupBy"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  }
  
  `
  let ts = `
import { PrismaClient } from  '@prisma/client'
const client = new PrismaClient();

async function main(){
  const a = await client.a.findMany()
}
`
  const modelMap = new Map<string, Model>()
  for (let i = 1; i < 200; i++) {
    const modelName = numberToBase26(i).toLowerCase()
    if (
      ['as', 'and', 'or', 'do', 'in', 'if', 'for', 'any'].includes(modelName)
    ) {
      continue
    }
    const model = new Model({
      name: modelName,
      body: `
    id        Int      @id @default(autoincrement())
    int             Int
    optionalInt     Int?
    float           Float
    optionalFloat   Float?
    string          String
    optionalString  String?
    json            Json
    optionalJson    Json?
    boolean         Boolean
    optionalBoolean Boolean?
`,
    })
    modelMap.set(modelName, model)
  }
  modelMap.forEach((model) => {
    schema += model.build()
  })
  const schemaPath = path.join(__dirname, 'schema.prisma')
  const tsPath = path.join(__dirname, 'compile_test.ts')

  write(schemaPath, schema)
  write(tsPath, ts)
}

main().catch((e) => {
  console.log(e)
})
