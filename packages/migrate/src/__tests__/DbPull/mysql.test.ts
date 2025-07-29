import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { setupMysql, tearDownMysql } from '../../utils/setupMysql'
import { SetupParams } from '../../utils/setupPostgres'
import { allDriverAdapters, describeMatrix } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const testIf = (condition: boolean) => (condition ? test : test.skip)

const ctx = createDefaultTestContext()

describeMatrix({ providers: { mysql: true }, driverAdapters: allDriverAdapters }, 'mysql', () => {
  const connectionString = process.env.TEST_MYSQL_URI!.replace('tests-migrate', 'tests-migrate-db-pull-mysql')

  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MYSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'mysql'),
  }

  beforeAll(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMysql(setupParams).catch((e) => {
      console.error(e)
    })

    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MYSQL_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/mysql')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "datasource db {
        provider = "mysql"
        url      = env("TEST_MYSQL_URI")
      }

      model your_log {
        click_id     Int      @id @default(autoincrement())
        click_time   DateTime @db.DateTime(0)
        shorturl     String   @db.VarChar(200)
        referrer     String   @db.VarChar(200)
        user_agent   String   @db.VarChar(255)
        ip_address   String   @db.VarChar(41)
        country_code String   @db.Char(2)

        @@index([shorturl], map: "shorturl")
      }

      model your_options {
        option_id    BigInt @default(autoincrement()) @db.UnsignedBigInt
        option_name  String @default("") @db.VarChar(64)
        option_value String @db.LongText

        @@id([option_id, option_name])
        @@index([option_name], map: "option_name")
      }

      model your_url {
        keyword   String   @id @db.VarChar(200)
        url       String   @db.Text
        title     String?  @db.Text
        timestamp DateTime @default(now()) @db.Timestamp(0)
        ip        String   @db.VarChar(41)
        clicks    Int      @db.UnsignedInt

        @@index([ip], map: "ip")
        @@index([timestamp], map: "timestamp")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  // TODO: snapshot fails on CI for macOS and Windows because the connection
  // string is different, either add steps to the database setup to create the
  // user and set password for MySQL, or sanitize the snapshot.
  testIf(!isMacOrWindowsCI)('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "datasource db {
        provider = "mysql"
        url      = "mysql://root:root@localhost:3306/tests"
      }

      model your_log {
        click_id     Int      @id @default(autoincrement())
        click_time   DateTime @db.DateTime(0)
        shorturl     String   @db.VarChar(200)
        referrer     String   @db.VarChar(200)
        user_agent   String   @db.VarChar(255)
        ip_address   String   @db.VarChar(41)
        country_code String   @db.Char(2)

        @@index([shorturl], map: "shorturl")
      }

      model your_options {
        option_id    BigInt @default(autoincrement()) @db.UnsignedBigInt
        option_name  String @default("") @db.VarChar(64)
        option_value String @db.LongText

        @@id([option_id, option_name])
        @@index([option_name], map: "option_name")
      }

      model your_url {
        keyword   String   @id @db.VarChar(200)
        url       String   @db.Text
        title     String?  @db.Text
        timestamp DateTime @default(now()) @db.Timestamp(0)
        ip        String   @db.VarChar(41)
        clicks    Int      @db.UnsignedInt

        @@index([ip], map: "ip")
        @@index([timestamp], map: "timestamp")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
