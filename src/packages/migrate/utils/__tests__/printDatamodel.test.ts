import chalk from 'chalk'
import { printDatamodelDiff } from '../printDatamodelDiff'
chalk.level = 0 // TODO: get back to colors

const datamodelA = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  authors Blog[]
}

model Post {
  id Int @id
  title String
  anotherText String
  text String
  tags String[]
  blog Blog
}`

const datamodelB = `model Blog {
  id Int @id
  this String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  authors Blog[]
}

model Post {
  id Int @id
  title String
  anotherText String
  text String
  tags String[]
  blog Blog
}`

test('basic diff', () => {
  const diff = printDatamodelDiff(datamodelA, datamodelB)
  // console.log(diff)
  expect(diff).toMatchSnapshot()
})

test('rename field', () => {
  const before = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}`

  const after = `model Blog {
  id String @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}`

  const diff = printDatamodelDiff(before, after)
  // console.log(diff)
  expect(diff).toMatchSnapshot()
})

test('add model', () => {
  const before = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}`

  const after = `model Blog {
  id String @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Blog2 {
  id String @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}
`

  const diff = printDatamodelDiff(before, after)
  // console.log(diff)
  expect(diff).toMatchSnapshot()
})

test('copy model', () => {
  const datamodelC = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  authors Blog[]
}

model Post {
  id Int @id
  title String
  anotherText String
  text String
  tags String[]
  blog Blog
}

model Blog2 {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}
`
  const diff = printDatamodelDiff(datamodelA, datamodelC)
  // console.log(diff)
  expect(diff).toMatchSnapshot()
})

test('add post4', () => {
  const newBefore = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  name2 String?
}

model Post {
  id Int @id
  anotherString String?
}

model Post4 {
  id Int @id
  anotherString String?
}`

  const newAfter = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  name2 String?
}

model Post {
  id Int @id
  anotherString String?
}

model Post4 {
  id Int @id
  anotherString String?
}

model Post5 {
  id Int @id
  anotherString String?
}`

  const diff = printDatamodelDiff(newBefore, newAfter)
  // console.log(diff)
  expect(diff).toMatchSnapshot()
})

test('add comments', () => {
  const nikoBefore = `model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  posts Post[]
  blog Blog
}

model Post {
  id Int @id
  title String
  tags String[]
  blog Blog
}`

  const nikoAfter = `datasource pg {

}
model Blog {
  id Int @id
  name String
  viewCount Int
  posts Post[]
  authors Author[]
}

model Author {
  id Int @id
  name String?
  posts Post[]
  blog Blog
  comments Comment[]
}

model Post {
  id Int @id
  title String
  tags String[]
  blog Blog
  comments Comment[]
}

model Comment {
  id Int @id
  text String
  writtenBy Author
  post Post
}`

  const diff = printDatamodelDiff(nikoBefore, nikoAfter)
  // console.log(diff)
  expect(diff).toMatchSnapshot()
})

test('add fullName', () => {
  const before = `datasource db {
    provider = "sqlite"
    url      = "file:dev.db"
    default  = true
  }

generator client {
  provider = "prisma-client-js"
}

model User {
  id Int @id
  firstName String
  lastName String
}

  `

  const after = `datasource db {
    provider = "sqlite"
    url      = "file:dev.db"
    default  = true
  }

generator client {
  provider = "prisma-client-js"
}

model User {
  id Int @id
  firstName String
  lastName String
  fullName String?
}

  `

  const diff = printDatamodelDiff(before, after)
  expect(diff).toMatchSnapshot()
  // console.log(diff)
})

test('make fullName required rm linebreak', () => {
  const before = `
model User {
  id Int @id
  firstName String
  lastName String
  fullName String?
}`

  const after = `model User {
  id Int @id
  firstName String
  lastName String
  fullName String
}
  `

  const diff = printDatamodelDiff(before, after)
  expect(diff).toMatchSnapshot()
  // console.log(diff)
})

test('make fullName required add linebreak', () => {
  const before = `model User {
  id Int @id
  firstName String
  lastName String
  fullName String?
}`

  const after = `
model User {
  id Int @id
  firstName String
  lastName String
  fullName String
}
  `

  const diff = printDatamodelDiff(before, after)
  expect(diff).toMatchSnapshot()
  // console.log(diff)
})

test('ignore spacing', () => {
  const before = `model User {
  id        Int    @id
  firstName String
  lastName  String
  fullName  String
}
`

  const after = `model User {
  id                        Int    @id
  firstName                 String
  lastName                  String
  fullNameWithAVeryLongName String
}`

  const diff = printDatamodelDiff(before, after)
  expect(diff).toMatchSnapshot()
  // console.log(diff)
})
