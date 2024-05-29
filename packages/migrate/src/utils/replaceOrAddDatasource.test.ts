import { replaceOrAddDatasource } from './replaceOrAddDatasource'

const replacement = `datasource new {
 provider = "sqlite"
 url = "file:new.db"
}`

test('single file, with existing datasource', () => {
  const result = replaceOrAddDatasource(replacement, [
    [
      'a.prisma',
      `
datasource db {
    provider = "postgresql"
    url = "postgresql://example.com/db"
}

model A {
    id Int @id
}
`,
    ],
  ])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "a.prisma",
        "datasource new {
     provider = "sqlite"
     url = "file:new.db"
    }

    model A {
        id Int @id
    }",
      ],
    ]
  `)
})

test('single file, with no datasource', () => {
  const result = replaceOrAddDatasource(replacement, [
    [
      'a.prisma',
      `
  model A {
      id Int @id
  }
  `,
    ],
  ])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "a.prisma",
        "datasource new {
     provider = "sqlite"
     url = "file:new.db"
    }

      model A {
          id Int @id
      }
      ",
      ],
    ]
  `)
})

test('single file, empty', () => {
  const result = replaceOrAddDatasource(replacement, [['a.prisma', '']])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "a.prisma",
        "datasource new {
     provider = "sqlite"
     url = "file:new.db"
    }
    ",
      ],
    ]
  `)
})

test('single file, with existing datasource and commented out closing bracket', () => {
  const result = replaceOrAddDatasource(replacement, [
    [
      'a.prisma',
      `
  datasource db {
      provider = "postgresql"
      url = "postgresql://example.com/db"
      // }
  }
  
  model A {
      id Int @id
  }
  `,
    ],
  ])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "a.prisma",
        "datasource new {
     provider = "sqlite"
     url = "file:new.db"
    }

    model A {
          id Int @id
      }",
      ],
    ]
  `)
})

test('multiple files, with existing datasource', () => {
  const result = replaceOrAddDatasource(replacement, [
    [
      'a.prisma',
      `
model A {
    id Int @id
}
`,
    ],

    [
      'b.prisma',
      `
datasource db {
    provider = "postgresql"
    url = "postgresql://example.com/db"
}

model B {
    id Int @id
}
    `,
    ],
  ])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "a.prisma",
        "
    model A {
        id Int @id
    }
    ",
      ],
      [
        "b.prisma",
        "datasource new {
     provider = "sqlite"
     url = "file:new.db"
    }

    model B {
        id Int @id
    }",
      ],
    ]
  `)
})

test('multiple files, no datasource', () => {
  const result = replaceOrAddDatasource(replacement, [
    [
      'a.prisma',
      `
  model A {
      id Int @id
  }
  `,
    ],

    [
      'b.prisma',
      `
  model B {
      id Int @id
  }
      `,
    ],
  ])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "a.prisma",
        "datasource new {
     provider = "sqlite"
     url = "file:new.db"
    }

      model A {
          id Int @id
      }
      ",
      ],
      [
        "b.prisma",
        "
      model B {
          id Int @id
      }
          ",
      ],
    ]
  `)
})
