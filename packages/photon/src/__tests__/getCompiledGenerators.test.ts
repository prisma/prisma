import { getCompiledGenerators } from '../getCompiledGenerators'
import { pick } from '../pick'

const datamodel = /* GraphQL */ `
datasource sqlite {
  provider = "sqlite"
  url      = "file:my.db"
}

generator photonjs {
  provider = "photonjs"
}

generator nexus_prisma {
  provider = "nexus-prisma"
}

model User {
  id    String  @id @default(cuid())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id        String  @id @default(cuid())
  title     String
  published Boolean @default(true)
  author    User?
}`

test('getCompiledGenerators', async () => {
  const generators = await getCompiledGenerators(process.cwd(), datamodel, {
    photonjs: {
      packagePath: '@prisma/photon',
      definition: {
        defaultOutput: 'node_modules/@generated/photon',
        prettyName: 'Photon JS Client',
        generate: options => {
          expect(options.generator.output).toContain('/node_modules/@generated/photon')
          expect(options.otherGenerators[0].output).toContain('/node_modules/@generated/nexus-prisma')
          expect(pick(options, ['dataSources', 'datamodel'])).toMatchSnapshot()
          return Promise.resolve('')
        },
      },
    },
    'nexus-prisma': {
      packagePath: 'nexus-prisma',
      definition: {
        defaultOutput: 'node_modules/@generated/nexus-prisma',
        prettyName: 'Nexus Prisma',
        generate: options => {
          expect(options.generator.output).toContain('/node_modules/@generated/nexus-prisma')
          expect(options.otherGenerators[0].output).toContain('/node_modules/@generated/photon')
          expect(pick(options, ['dataSources', 'datamodel'])).toMatchSnapshot()
          return Promise.resolve('')
        },
      },
    },
  })

  for (const generator of generators) {
    generator.generate()
  }

  const sanitizedGenerators = generators.map(g => ({
    ...g,
    output: sanitizeOutput(g.output),
  }))

  expect(sanitizedGenerators).toMatchInlineSnapshot(`
    Array [
      Object {
        "generate": [Function],
        "output": "@generated/photon",
        "prettyName": "Photon JS Client",
      },
      Object {
        "generate": [Function],
        "output": "@generated/nexus-prisma",
        "prettyName": "Nexus Prisma",
      },
    ]
  `)
})

function sanitizeOutput(output?: string | null) {
  if (!output) {
    return output
  }
  const indexOfGenerated = output.indexOf('@generated')
  return output.slice(indexOfGenerated)
}
