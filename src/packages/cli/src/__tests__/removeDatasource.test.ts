import { removeDatasource } from '../utils/removeDatasource'

test('simple schema', () => {
  const schema = `
datasource db {
  provider = "sqlite"
  url = "file:dev.db"
}


generator gen {
  provider = "prisma-client-js"
}

model User {
  id   Int @id @default(autoincrement())
  name String
}
`
  expect(removeDatasource(schema)).toMatchInlineSnapshot(`
    generator gen {
      provider = "prisma-client-js"
    }

    model User {
      id   Int @id @default(autoincrement())
      name String
    }
  `)
})

test('comments', () => {
  const schema = `
datasource db {
// datasource db {
  provider = "sqlite"
  // provider = "sqlite"
  url = "file:dev.db"
}


generator gen {
  provider = "prisma-client-js"
}

model User {
  id   Int @id @default(autoincrement())
  name String
}
`
  expect(removeDatasource(schema)).toMatchInlineSnapshot(`
    generator gen {
      provider = "prisma-client-js"
    }

    model User {
      id   Int @id @default(autoincrement())
      name String
    }
  `)
})

test('schema without datasource', () => {
  const schema = `

generator gen {
  provider = "prisma-client-js"
}

model User {
  id   Int @id @default(autoincrement())
  name String
}
`
  expect(removeDatasource(schema)).toMatchInlineSnapshot(`
    generator gen {
      provider = "prisma-client-js"
    }

    model User {
      id   Int @id @default(autoincrement())
      name String
    }
  `)
})

test('schema with multiple datasources', () => {
  const schema = `
datasource db {
  provider = "sqlite"
  url = "file:dev.db"
}

datasource db2 {
  provider = "sqlite"
  url = "file:dev.db"
}


generator gen {
  provider = "prisma-client-js"
}

model User {
  id   Int @id @default(autoincrement())
  name String
}
`
  expect(removeDatasource(schema)).toMatchInlineSnapshot(`
    generator gen {
      provider = "prisma-client-js"
    }

    model User {
      id   Int @id @default(autoincrement())
      name String
    }
  `)
})
