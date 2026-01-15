import type { RuntimeDataModel } from '@prisma/client-common'
import { getDMMF } from '@prisma/client-generator-js'
import { buildParamGraph } from '@prisma/param-graph-builder'

import { createParamGraphView, type ParamGraphView } from '../param-graph-view'

/**
 * Prisma schema that simulates a User model with common fields and filters,
 * along with related Post and Profile models.
 */
const testSchema = /* prisma */ `
  datasource db {
    provider = "postgresql"
  }

  enum Status {
    ACTIVE
    INACTIVE
  }

  model User {
    id        Int       @id @default(autoincrement())
    email     String    @unique
    name      String?
    age       Int?
    salary    Float?
    isActive  Boolean   @default(true)
    deletedAt DateTime?
    createdAt DateTime  @default(now())
    balance   Decimal?
    status    Status    @default(ACTIVE)
    avatar    Bytes?

    posts     Post[]
    profile   Profile?

    // Self-relation for testing nested relation filters (author field in tests)
    authorId  Int?
    author    User?   @relation("UserAuthor", fields: [authorId], references: [id])
    authored  User[]  @relation("UserAuthor")
  }

  model Post {
    id        Int      @id @default(autoincrement())
    title     String
    content   String?
    userId    Int
    user      User     @relation(fields: [userId], references: [id])
    createdAt DateTime @default(now())
  }

  model Profile {
    id     Int     @id @default(autoincrement())
    bio    String?
    userId Int     @unique
    user   User    @relation(fields: [userId], references: [id])
  }
`

/**
 * RuntimeDataModel containing enum information extracted from the schema.
 */
export const testRuntimeDataModel: RuntimeDataModel = {
  models: {},
  enums: {
    Status: {
      values: [
        { name: 'ACTIVE', dbName: null },
        { name: 'INACTIVE', dbName: null },
      ],
      dbName: null,
    },
  },
  types: {},
}

let _view: ParamGraphView | undefined

/**
 * Initializes the test fixtures by parsing the schema and building the ParamGraph.
 * This is called lazily on first access to the view.
 */
async function initializeFixtures(): Promise<ParamGraphView> {
  if (_view) {
    return _view
  }

  const dmmf = await getDMMF({ datamodel: testSchema })
  const paramGraph = buildParamGraph(dmmf)
  _view = createParamGraphView(paramGraph, testRuntimeDataModel)
  return _view
}

/**
 * Pre-initialized view for synchronous access in tests.
 * Tests should call `await initializeTestFixtures()` in a `beforeAll` hook,
 * or the module will initialize lazily.
 */
export let view: ParamGraphView

/**
 * Initialize test fixtures. Call this in beforeAll if you need guaranteed
 * initialization before tests run.
 */
export async function initializeTestFixtures(): Promise<void> {
  view = await initializeFixtures()
}

// Eagerly initialize the fixtures when the module is loaded.
const initPromise = initializeFixtures().then((v) => {
  view = v
})

// Export the initialization promise for tests that need to await it explicitly
export { initPromise }
