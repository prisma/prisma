import Debug from '@prisma/debug'
import { Headers } from 'node-fetch'
import stripAnsi from 'strip-ansi'

import { getErrorMessageWithLink } from '../common/errors/utils/getErrorMessageWithLink'
import { responseToError } from '../data-proxy/errors/utils/responseToError'
import type { RequestResponse } from '../data-proxy/utils/request'

const response = (body: Promise<any>, code?: number, requestId?: string): RequestResponse => ({
  json: () => body,
  url: '',
  ok: false,
  status: code || 400,
  headers: new Headers({
    'PDP-Request-Id': requestId,
  }),
})

describe('responseToError', () => {
  test('serialization of 500 with default message', async () => {
    expect.assertions(2)

    try {
      await responseToError(response(Promise.reject(), 500), '')
    } catch (error) {
      expect(error.message).toEqual('Unknown server error')
      expect(error.logs).toBe(undefined)
    }
  })

  test('serialization of 500 with useful message', async () => {
    expect.assertions(2)

    const errorJSON = {
      EngineNotStarted: {
        reason: 'VersionNotSupported',
      },
    }

    try {
      await responseToError(response(Promise.resolve(errorJSON), 500), '')
    } catch (error) {
      expect(error.message).toEqual('VersionNotSupported')
      expect(error.logs).toBe(undefined)
    }
  })

  test('serialization of 500 with engine logs', async () => {
    expect.assertions(2)

    const errorJSON = {
      EngineNotStarted: {
        reason: {
          HealthcheckTimeout: {
            logs: [
              '{"timestamp":"2022-04-14T12:01:00.487760Z","level":"INFO","fields":{"message":"Encountered error during initialization:"},"target":"query_engine"}\r\n',
              '{"is_panic":false,"message":"Database error. error code: unknown, error message: Server selection timeout: No available servers. Topology: { Type: ReplicaSetNoPrimary, Servers: [ { Address: test-shard-00-00.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, { Address: test-shard-00-01.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, { Address: test-shard-00-02.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, ] }","backtrace":"   0: user_facing_errors::Error::new_non_panic_with_current_backtrace\\n   1: query_engine::error::<impl core::convert::From<query_engine::error::PrismaError> for user_facing_errors::Error>::from\\n   2: query_engine::error::PrismaError::render_as_json\\n   3: query_engine::main::main::{{closure}}::{{closure}}\\n   4: <core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll\\n   5: std::thread::local::LocalKey<T>::with\\n   6: <core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll\\n   7: async_io::driver::block_on\\n   8: std::thread::local::LocalKey<T>::with\\n   9: std::thread::local::LocalKey<T>::with\\n  10: async_std::task::builder::Builder::blocking\\n  11: query_engine::main\\n  12: std::sys_common::backtrace::__rust_begin_short_backtrace\\n  13: std::rt::lang_start::{{closure}}\\n  14: core::ops::function::impls::<impl core::ops::function::FnOnce<A> for &F>::call_once\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/core/src/ops/function.rs:259:13\\n      std::panicking::try::do_call\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:403:40\\n      std::panicking::try\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:367:19\\n      std::panic::catch_unwind\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panic.rs:133:14\\n      std::rt::lang_start_internal::{{closure}}\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/rt.rs:128:48\\n      std::panicking::try::do_call\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:403:40\\n      std::panicking::try\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:367:19\\n      std::panic::catch_unwind\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panic.rs:133:14\\n      std::rt::lang_start_internal\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/rt.rs:128:20\\n  15: main\\n  16: __libc_start_main\\n  17: <unknown>\\n"}\r\n',
            ],
          },
        },
      },
    }

    try {
      await responseToError(response(Promise.resolve(errorJSON), 500), '')
    } catch (error) {
      expect(error.message).toEqual('HealthcheckTimeout')
      expect(error.logs).toEqual([
        '{"timestamp":"2022-04-14T12:01:00.487760Z","level":"INFO","fields":{"message":"Encountered error during initialization:"},"target":"query_engine"}\r\n',
        '{"is_panic":false,"message":"Database error. error code: unknown, error message: Server selection timeout: No available servers. Topology: { Type: ReplicaSetNoPrimary, Servers: [ { Address: test-shard-00-00.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, { Address: test-shard-00-01.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, { Address: test-shard-00-02.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, ] }","backtrace":"   0: user_facing_errors::Error::new_non_panic_with_current_backtrace\\n   1: query_engine::error::<impl core::convert::From<query_engine::error::PrismaError> for user_facing_errors::Error>::from\\n   2: query_engine::error::PrismaError::render_as_json\\n   3: query_engine::main::main::{{closure}}::{{closure}}\\n   4: <core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll\\n   5: std::thread::local::LocalKey<T>::with\\n   6: <core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll\\n   7: async_io::driver::block_on\\n   8: std::thread::local::LocalKey<T>::with\\n   9: std::thread::local::LocalKey<T>::with\\n  10: async_std::task::builder::Builder::blocking\\n  11: query_engine::main\\n  12: std::sys_common::backtrace::__rust_begin_short_backtrace\\n  13: std::rt::lang_start::{{closure}}\\n  14: core::ops::function::impls::<impl core::ops::function::FnOnce<A> for &F>::call_once\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/core/src/ops/function.rs:259:13\\n      std::panicking::try::do_call\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:403:40\\n      std::panicking::try\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:367:19\\n      std::panic::catch_unwind\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panic.rs:133:14\\n      std::rt::lang_start_internal::{{closure}}\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/rt.rs:128:48\\n      std::panicking::try::do_call\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:403:40\\n      std::panicking::try\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:367:19\\n      std::panic::catch_unwind\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panic.rs:133:14\\n      std::rt::lang_start_internal\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/rt.rs:128:20\\n  15: main\\n  16: __libc_start_main\\n  17: <unknown>\\n"}\r\n',
      ])
    }
  })

  test('serialization of 400 includes default message if it is not a known error', async () => {
    expect.assertions(2)

    try {
      await responseToError(response(Promise.reject()), '')
    } catch (error) {
      expect(error.message).toEqual('This request could not be understood by the server')
      expect(error.code).toEqual('P5000')
    }
  })

  test('serialization of 400 includes original cause from data proxy if it is a known error', async () => {
    expect.assertions(2)

    const errorJSON = {
      EngineNotStarted: {
        reason: {
          KnownEngineStartupError: {
            msg: 'Authentication failed against database server at `my-database.random-id.eu-west-1.rds.amazonaws.com`, the provided database credentials for `username` are not valid.\n\nPlease make sure to provide valid database credentials for the database server at `my-database.random-id.eu-west-1.rds.amazonaws.com`.',
            error_code: 'P1000',
          },
        },
      },
    }

    try {
      await responseToError(response(Promise.resolve(errorJSON)), '')
    } catch (error) {
      expect(error.message).toEqual(
        'Authentication failed against database server at `my-database.random-id.eu-west-1.rds.amazonaws.com`, the provided database credentials for `username` are not valid.\n\nPlease make sure to provide valid database credentials for the database server at `my-database.random-id.eu-west-1.rds.amazonaws.com`.',
      )
      expect(error.code).toEqual('P1000')
    }
  })

  test('The PDP request Id is added to error messages if the header is present in the response', async () => {
    expect.assertions(1)

    try {
      await responseToError(response(Promise.reject(), 404, 'some-request-id'), '')
    } catch (error) {
      expect(error.message).toEqual('... The request id is: some-request-id')
    }
  })
})

describe('getErrorMessageWithLink', () => {
  test('basic serialization', () => {
    const debug = Debug('test-namespace')
    debug('hello')
    const message = getErrorMessageWithLink({
      platform: 'darwin',
      title: 'This is a title',
      version: '1.2.3',
      description: 'This is some crazy description',
      query: 'QUERY',
      database: 'mongodb',
      engineVersion: 'abcdefhg',
    })
    expect(
      stripAnsi(message)
        .replace(/v\d{1,2}\.\d{1,2}\.\d{1,2}/, 'NODE_VERSION')
        .replace(/[\+-]/g, ''),
    ).toMatchInlineSnapshot(`
      "This is a title

      This is a nonrecoverable error which probably happens when the Prisma Query Engine has a panic.

      https://github.com/prisma/prisma/issues/new?body=HiPrismaTeam%21MyPrismaClientjustcrashed.Thisisthereport%3A%0A%23%23Versions%0A%0A%7CName%7CVersion%7C%0A%7C%7C%7C%0A%7CNode%7CNODE_VERSION%7C%0A%7COS%7Cdarwin%7C%0A%7CPrismaClient%7C1.2.3%7C%0A%7CQueryEngine%7Cabcdefhg%7C%0A%7CDatabase%7Cmongodb%7C%0A%0A%23Description%0A%60%60%60%0AThisissomecrazydescription%0A%60%60%60%0A%0A%23%23Logs%0A%60%60%60%0Atestnamespacehello%0A%60%60%60%0A%0A%23%23ClientSnippet%0A%60%60%60ts%0A%2F%2FPLEASEFILLYOURCODESNIPPETHERE%0A%60%60%60%0A%0A%23%23Schema%0A%60%60%60prisma%0A%2F%2FPLEASEADDYOURSCHEMAHEREIFPOSSIBLE%0A%60%60%60%0A%0A%23%23PrismaEngineQuery%0A%60%60%60%0AQUERY%0A%60%60%60%0A&title=Thisisatitle&template=bug_report.md

      If you want the Prisma team to look into it, please open the link above 🙏
      To increase the chance of success, please post your schema and a snippet of
      how you used Prisma Client in the issue. 
      "
    `)
  })
})
