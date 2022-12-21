import { foreignKeyForProvider, idForProvider } from '../../../_utils/idForProvider'
import testMatrix from '../_matrix'

function createModelToManyField(times: number) {
  const models: string[] = []
  for (let i = 0; i < times; i++) {
    models.push(`myModel${i} MyModel${i}[]`)
  }

  return models.join('\n')
}

function createModel(times: number, provider: string) {
  const models: string[] = []
  for (let i = 0; i < times; i++) {
    models.push(`model MyModel${i} {
      id ${idForProvider(provider)}
      ${createModelField(10)}
      user   User   @relation(fields: [userId], references: [id])
      userId String
    }`)
  }

  return models.join('\n')
}

function createModelField(times: number) {
  const fields: string[] = []
  for (let i = 0; i < times; i++) {
    fields.push(`myField${i} String`)
  }

  return fields.join('\n')
}

export default testMatrix.setupSchema(({ provider }) => {
  return /* Prisma */ `
  generator client {
    provider = "prisma-client-js"
    previewFeatures = ["clientExtensions"]
  }
  
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URI_${provider}")
  }
  
  model User {
    id ${idForProvider(provider)}
    email String @unique
    firstName String
    lastName String
    posts Post[]
    ${createModelToManyField(20)}
  }

  model Post {
    id ${idForProvider(provider)}
    user User @relation(fields: [userId], references: [id])
    userId ${foreignKeyForProvider(provider)}
  }

  // the following models aren't used in the tests, but are here to test the performance of the extension
  ${createModel(20, provider)}
  `
})
