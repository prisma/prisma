import { printDatamodelDiff } from '../printDatamodelDiff'

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
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel Blog[39m [38;5;109m{[39m
          id[38;5;109m Int[39m [36m@id[39m
        [91m  [39m[1;31;48;5;52mname[m[91m String[39m
        [92m  [39m[1;32;48;5;22mthis[m[92m String[39m
          viewCount[38;5;109m Int[39m
          posts[38;5;109m Post[39m[]
          authors[38;5;109m Author[39m[]
        [38;5;109m}[39m"
    `)
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
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel Blog[39m [38;5;109m{[39m
        [91m  id [39m[1;31;48;5;52mInt[m[91m @id[39m
        [92m  id [39m[1;32;48;5;22mString[m[92m @id[39m
          name[38;5;109m String[39m
          viewCount[38;5;109m Int[39m
          posts[38;5;109m Post[39m[]
          authors[38;5;109m Author[39m[]
        [38;5;109m}[39m"
    `)
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
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel Blog[39m [38;5;109m{[39m
        [91m  id [39m[1;31;48;5;52mInt[m[91m @id[39m
        [92m  id [39m[1;32;48;5;22mString[m[92m @id[39m
          name[38;5;109m String[39m
          viewCount[38;5;109m Int[39m
          posts[38;5;109m Post[39m[]
          authors[38;5;109m Author[39m[]
        [38;5;109m}[39m
        [92mmodel Blog2 {[39m
        [92m  id String @id[39m
        [92m  name String[39m
        [92m  viewCount Int[39m
        [92m  posts Post[][39m
        [92m  authors Author[][39m
        [92m}[39m
        [92m[39m"
    `)
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
  expect(diff).toMatchInlineSnapshot(`
                "[92mmodel Blog2 {[39m
                [92m  id Int @id[39m
                [92m  name String[39m
                [92m  viewCount Int[39m
                [92m  posts Post[][39m
                [92m  authors Author[][39m
                [92m}[39m
                [92m[39m"
        `)
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
  expect(diff).toMatchInlineSnapshot(`
                "[92mmodel Post5 {[39m
                [92m  id Int @id[39m
                [92m  anotherString String?[39m
                [92m}[39m"
        `)
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
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel Author[39m [38;5;109m{[39m
          id[38;5;109m Int[39m [36m@id[39m
          name[38;5;109m String[39m?
          posts[38;5;109m Post[39m[]
          blog[38;5;109m Blog[39m
        [92m  comments Comment[][39m
        [38;5;109m}[39m

        [36mmodel Post[39m [38;5;109m{[39m
          id[38;5;109m Int[39m [36m@id[39m
          title[38;5;109m String[39m
          tags[38;5;109m String[39m[]
          blog[38;5;109m Blog[39m
        [92m  comments Comment[][39m
        [38;5;109m}[39m
        [92mmodel Comment {[39m
        [92m  id Int @id[39m
        [92m  text String[39m
        [92m  writtenBy Author[39m
        [92m  post Post[39m
        [92m}[39m"
    `)
})

test('add fullName', () => {
  const before = `datasource db {
    provider = "sqlite"
    url      = "file:dev.db"
    default  = true
  }

generator photon {
  provider = "photonjs"
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

generator photon {
  provider = "photonjs"
}

model User {
  id Int @id
  firstName String
  lastName String
  fullName String?
}

  `

  const diff = printDatamodelDiff(before, after)
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel User[39m [38;5;109m{[39m
          id[38;5;109m Int[39m [36m@id[39m
          firstName[38;5;109m String[39m
          lastName[38;5;109m String[39m
        [92m  fullName String?[39m
        [38;5;109m}[39m"
    `)
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
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel User[39m [38;5;109m{[39m
          id[38;5;109m Int[39m [36m@id[39m
          firstName[38;5;109m String[39m
          lastName[38;5;109m String[39m
        [91m  fullName String[39m[1;31;48;5;52m?[m
        [92m  fullName String[39m
        [38;5;109m}[39m"
    `)
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
  expect(diff).toMatchInlineSnapshot(`
        "[36mmodel User[39m [38;5;109m{[39m
          id[38;5;109m Int[39m [36m@id[39m
          firstName[38;5;109m String[39m
          lastName[38;5;109m String[39m
        [91m  fullName String[39m[1;31;48;5;52m?[m
        [92m  fullName String[39m
        [38;5;109m}[39m"
    `)
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
  expect(diff).toMatchInlineSnapshot(`
    "[36mmodel User[39m [38;5;109m{[39m
      id[38;5;109m Int[39m [36m@id[39m
      firstName[38;5;109m String[39m
      lastName[38;5;109m String[39m
    [91m  [39m[1;31;48;5;52mfullName[m[91m String[39m
    [92m  [39m[1;32;48;5;22mfullNameWithAVeryLongName[m[92m String[39m
    [38;5;109m}[39m"
  `)
  // console.log(diff)
})
