import { jestContext, serializeQueryEngineName } from '@prisma/internals'

import { Validate } from '../../Validate'

const ctx = jestContext.new().assemble()

it('validate should succeed if schema is valid', async () => {
  ctx.fixture('example-project/prisma')
  await expect(Validate.new().parse(['--schema=schema.prisma'])).resolves.toContain('is valid')
})

it('validate should throw if schema is invalid', async () => {
  ctx.fixture('example-project/prisma')
  await expect(Validate.new().parse(['--schema=broken.prisma'])).rejects.toThrowError('Schema validation error')
})

it('validate should throw if env var is not set', async () => {
  ctx.fixture('example-project/prisma')
  await expect(Validate.new().parse(['--schema=env-does-not-exists.prisma'])).rejects.toThrowError(
    'Environment variable not found',
  )
})

describe('referential actions', () => {
  beforeEach(() => {
    ctx.fixture('referential-actions/no-action/relationMode-prisma')
  })

  it('validate should reject NoAction referential action on Postgres when relationMode = "prisma"', async () => {
    expect.assertions(1)

    try {
      await Validate.new().parse(['--schema', './prisma/postgres.prisma'])
    } catch (e) {
      expect(serializeQueryEngineName(e.message)).toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-NORMALIZED)
        Error code: P1012
        error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relationMode
          -->  schema.prisma:21
           | 
        20 |   id       String @id @default(cuid())
        21 |   user     SomeUser @relation(fields: [userId], references: [id], onUpdate: NoAction)
           | 
        error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relationMode
          -->  schema.prisma:28
           | 
        27 |   id       String @id @default(cuid())
        28 |   user     SomeUser @relation(fields: [userId], references: [id], onDelete: NoAction)
           | 

        Validation Error Count: 2
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    }
  })

  it('validate should reject NoAction referential action on sqlite when relationMode = "prisma"', async () => {
    expect.assertions(1)

    try {
      await Validate.new().parse(['--schema', './prisma/postgres.prisma'])
    } catch (e) {
      expect(serializeQueryEngineName(e.message)).toMatchInlineSnapshot(`
        Schema validation error - Error (query-engine-NORMALIZED)
        Error code: P1012
        error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relationMode
          -->  schema.prisma:21
           | 
        20 |   id       String @id @default(cuid())
        21 |   user     SomeUser @relation(fields: [userId], references: [id], onUpdate: NoAction)
           | 
        error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relationMode
          -->  schema.prisma:28
           | 
        27 |   id       String @id @default(cuid())
        28 |   user     SomeUser @relation(fields: [userId], references: [id], onDelete: NoAction)
           | 

        Validation Error Count: 2
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    }
  })

  it('validate should accept NoAction referential action on e.g. MySQL when relationMode = "prisma"', async () => {
    const result = await Validate.new().parse(['--schema', './prisma/mysql.prisma'])
    expect(result).toBeTruthy()
  })
})
