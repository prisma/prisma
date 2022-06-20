import path from 'path'

import { dotenvExpand } from '../dotenvExpand'
import { fixturesPath } from './__utils__/fixtures'

describe('dotenvExpand', () => {
  test('should not expand', () => {
    const config = {
      parsed: {
        SQLITE1: 'file:dev.db',
        SQLITE2: 'file:$dev.db',
        SQLITE3: 'file:$dev$.db',
        SQLITE4: 'file:$dev.db',
        SQLITE5: 'file:dev$.db',
        SQLITE6: 'file:dev{$.db',
        SQLITE7: 'file:${dev.db',
        SQLITE8: 'file:${dev$.db',
        POSTGRES1: 'postgres://user:password@server.host:5432/database?ssl=1&schema=schema$1234',
        POSTGRES2: 'postgres://$user:password@server.host:5432/database?ssl=1&schema=schema$1234',
        POSTGRES3: 'postgres://u$ser:pass$word@server.host:5432/database?ssl=1&schema=schema$1234',
        POSTGRES4: 'postgres://user:password@serv$er.host:5432/database?ssl=1&schema=schema$1234',
        MYSQL1: 'mysql://user:password@serv$er.host:5432/$database',
        MYSQL2: 'mysql://user:password@server.host:5432/d$atabase',
      },
    }
    expect(dotenvExpand(config)).toMatchInlineSnapshot(`
      Object {
        "parsed": Object {
          "MYSQL1": "mysql://user:password@serv$er.host:5432/$database",
          "MYSQL2": "mysql://user:password@server.host:5432/d$atabase",
          "POSTGRES1": "postgres://user:password@server.host:5432/database?ssl=1&schema=schema$1234",
          "POSTGRES2": "postgres://$user:password@server.host:5432/database?ssl=1&schema=schema$1234",
          "POSTGRES3": "postgres://u$ser:pass$word@server.host:5432/database?ssl=1&schema=schema$1234",
          "POSTGRES4": "postgres://user:password@serv$er.host:5432/database?ssl=1&schema=schema$1234",
          "SQLITE1": "file:dev.db",
          "SQLITE2": "file:$dev.db",
          "SQLITE3": "file:$dev$.db",
          "SQLITE4": "file:$dev.db",
          "SQLITE5": "file:dev$.db",
          "SQLITE6": "file:dev{$.db",
          "SQLITE7": "file:\${dev.db",
          "SQLITE8": "file:\${dev$.db",
        },
      }
    `)
  })
  test('should expand', () => {
    const config = {
      parsed: {
        DOTENV_PRISMA_EXPAND_DATABASE_URL: 'postgres://user:password@server.host:5432/database',
        DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA: '${DOTENV_PRISMA_EXPAND_DATABASE_URL}?ssl=1&schema=schema$1234',
      },
    }
    expect(dotenvExpand(config)).toMatchInlineSnapshot(`
      Object {
        "parsed": Object {
          "DOTENV_PRISMA_EXPAND_DATABASE_URL": "postgres://user:password@server.host:5432/database",
          "DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA": "postgres://user:password@server.host:5432/database?ssl=1&schema=schema$1234",
        },
      }
    `)
  })

  /**
   * Following are the unit tests from the original package
   * https://github.com/motdotla/dotenv-expand/blob/master/test/main.js
   * adjusted to our fork, which does not expand without curly braces
   */
  it('returns object', () => {
    const dotenv = { parsed: {} }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toBeInstanceOf(Object)
  })

  it('expands environment variables', () => {
    const dotenv = {
      parsed: {
        BASIC: 'basic',
        BASIC_EXPAND: '${BASIC}',
        BASIC_EXPAND_SIMPLE: '$BASIC',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "BASIC": "basic",
        "BASIC_EXPAND": "basic",
        "BASIC_EXPAND_SIMPLE": "$BASIC",
      }
    `)
  })

  it('expands environment variables existing already on the machine', () => {
    process.env.MACHINE = 'machine'
    const dotenv = {
      parsed: {
        MACHINE_EXPAND: '${MACHINE}',
        MACHINE_EXPAND_SIMPLE: '$MACHINE',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "MACHINE_EXPAND": "machine",
        "MACHINE_EXPAND_SIMPLE": "$MACHINE",
      }
    `)
  })

  it('expands missing environment variables to an empty string', () => {
    const dotenv = {
      parsed: {
        UNDEFINED_EXPAND: '$UNDEFINED_ENV_KEY',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "UNDEFINED_EXPAND": "$UNDEFINED_ENV_KEY",
      }
    `)
  })

  it('prioritizes machine key expansion over .env', () => {
    process.env.MACHINE = 'machine'
    const dotenv = {
      parsed: {
        MACHINE: 'machine_env',
        MACHINE_EXPAND: '$MACHINE',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "MACHINE": "machine",
        "MACHINE_EXPAND": "machine",
      }
    `)
  })

  it('does not expand escaped variables', () => {
    const dotenv = {
      parsed: {
        ESCAPED_EXPAND: '\\$ESCAPED',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "ESCAPED_EXPAND": "\\\\$ESCAPED",
      }
    `)
  })

  it('does not expand inline escaped dollar sign', () => {
    const dotenv = {
      parsed: {
        INLINE_ESCAPED_EXPAND: 'pa\\$\\$word',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "INLINE_ESCAPED_EXPAND": "pa\\\\$\\\\$word",
      }
    `)
  })

  it('does not overwrite preset variables', () => {
    process.env.SOME_ENV = 'production'
    const dotenv = {
      parsed: {
        SOME_ENV: 'development',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "SOME_ENV": "production",
      }
    `)
  })

  it('does not expand inline escaped dollar sign 2', () => {
    const dotenv = {
      parsed: {
        INLINE_ESCAPED_EXPAND_BCRYPT: '\\$2b\\$10\\$OMZ69gxxsmRgwAt945WHSujpr/u8ZMx.xwtxWOCMkeMW7p3XqKYca',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "INLINE_ESCAPED_EXPAND_BCRYPT": "\\\\$2b\\\\$10\\\\$OMZ69gxxsmRgwAt945WHSujpr/u8ZMx.xwtxWOCMkeMW7p3XqKYca",
      }
    `)
  })

  it('handle mixed values', () => {
    const dotenv = {
      parsed: {
        PARAM1: '42',
        MIXED_VALUES: '\\$this$PARAM1\\$is${PARAM1}',
      },
    }
    const obj = dotenvExpand(dotenv).parsed

    expect(obj).toMatchInlineSnapshot(`
      Object {
        "MIXED_VALUES": "\\\\$this$PARAM1\\\\$is42",
        "PARAM1": "42",
      }
    `)
  })
})

describe('integration', function () {
  let dotenv

  beforeEach(() => {
    dotenv = require('dotenv').config({
      path: path.join(fixturesPath, 'dotenv/.env'),
    })
  })

  it('expands environment variables', () => {
    dotenvExpand(dotenv)

    expect(process.env['BASIC_EXPAND']).toBe('basic')
  })

  it('expands environment variables existing already on the machine', () => {
    process.env.MACHINE = 'machine'
    dotenvExpand(dotenv)

    expect(process.env['MACHINE_EXPAND']).toBe('machine')
  })

  it('expands missing environment variables to an empty string', () => {
    const obj = dotenvExpand(dotenv).parsed!

    expect(obj['UNDEFINED_EXPAND']).toBe('$UNDEFINED_ENV_KEY')
  })

  it('prioritizes machine key expansion over .env', () => {
    process.env.MACHINE = 'machine'
    const obj = dotenvExpand(dotenv).parsed!

    expect(obj['MACHINE_EXPAND']).toBe('machine')
  })

  it('multiple expand', () => {
    const obj = dotenvExpand(dotenv).parsed!

    expect(obj['MONGOLAB_URI']).toBe('mongodb://username:password@abcd1234.mongolab.com:12345/heroku_db')
  })

  it('should expand recursively', () => {
    const obj = dotenvExpand(dotenv).parsed!

    expect(obj['MONGOLAB_URI_RECURSIVELY']).toBe('mongodb://username:password@abcd1234.mongolab.com:12345/heroku_db')
  })

  it('multiple expand without curly', () => {
    const obj = dotenvExpand(dotenv).parsed!

    expect(obj['WITHOUT_CURLY_BRACES_URI']).toBe(
      'mongodb://$MONGOLAB_USER:$MONGOLAB_PASSWORD@$MONGOLAB_DOMAIN:$MONGOLAB_PORT/$MONGOLAB_DATABASE',
    )
  })

  it('should expand recursively without curly', () => {
    const obj = dotenvExpand(dotenv).parsed!

    expect(obj['WITHOUT_CURLY_BRACES_URI_RECURSIVELY']).toBe(
      'mongodb://$MONGOLAB_USER_RECURSIVELY@$MONGOLAB_DOMAIN:$MONGOLAB_PORT/$MONGOLAB_DATABASE',
    )
  })

  it('should not write to process.env if ignoreProcessEnv is set', () => {
    const dotenv = {
      ignoreProcessEnv: true,
      parsed: {
        SHOULD_NOT_EXIST: 'testing',
      },
    }
    const obj = dotenvExpand(dotenv).parsed!

    expect(process.env.SHOULD_NOT_EXIST).toBe(undefined)
    expect(obj.SHOULD_NOT_EXIST).toBe('testing')
  })
})
