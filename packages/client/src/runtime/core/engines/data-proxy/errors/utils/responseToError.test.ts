import type { RequestResponse } from '../../utils/request'
import { responseToError } from './responseToError'

const response = (body: string, code?: number, requestId?: string): RequestResponse => ({
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(body),
  url: '',
  ok: false,
  status: code || 400,
  headers: {
    'prisma-request-id': requestId,
  },
})

describe('responseToError', () => {
  test('serialization of 500 with default message', async () => {
    expect.assertions(2)

    try {
      await responseToError(response('', 500), '')
    } catch (error) {
      expect(error.message).toEqual('Unknown server error')
      expect(error.logs).toBe(undefined)
    }
  })

  test('serialization of 500 with useful message', async () => {
    expect.assertions(2)

    const errorJSON = {
      EngineNotStarted: {
        reason: 'EngineVersionNotSupported',
      },
    }

    try {
      await responseToError(response(JSON.stringify(errorJSON), 500), '')
    } catch (error) {
      expect(error.message).toEqual('Engine version is not supported')
      expect(error.logs).toBe(undefined)
    }
  })

  test('serialization of 500 with wrong shape', async () => {
    expect.assertions(1)

    const errorJSON = {
      EngineNotStarted: {
        reason: 'ILikeButterflies',
      },
    }

    try {
      await responseToError(response(JSON.stringify(errorJSON), 500), '')
    } catch (error) {
      expect(error.message).toEqual(
        'Unknown server error: {"type":"UnknownJsonError","body":{"EngineNotStarted":{"reason":"ILikeButterflies"}}}',
      )
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
      await responseToError(response(JSON.stringify(errorJSON), 500), '')
    } catch (error) {
      expect(error.message).toEqual('Engine not started: healthcheck timeout')
      expect(error.logs).toEqual([
        '{"timestamp":"2022-04-14T12:01:00.487760Z","level":"INFO","fields":{"message":"Encountered error during initialization:"},"target":"query_engine"}\r\n',
        '{"is_panic":false,"message":"Database error. error code: unknown, error message: Server selection timeout: No available servers. Topology: { Type: ReplicaSetNoPrimary, Servers: [ { Address: test-shard-00-00.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, { Address: test-shard-00-01.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, { Address: test-shard-00-02.abc.mongodb.net:27017, Type: Unknown, Error: Connection reset by peer (os error 104) }, ] }","backtrace":"   0: user_facing_errors::Error::new_non_panic_with_current_backtrace\\n   1: query_engine::error::<impl core::convert::From<query_engine::error::PrismaError> for user_facing_errors::Error>::from\\n   2: query_engine::error::PrismaError::render_as_json\\n   3: query_engine::main::main::{{closure}}::{{closure}}\\n   4: <core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll\\n   5: std::thread::local::LocalKey<T>::with\\n   6: <core::future::from_generator::GenFuture<T> as core::future::future::Future>::poll\\n   7: async_io::driver::block_on\\n   8: std::thread::local::LocalKey<T>::with\\n   9: std::thread::local::LocalKey<T>::with\\n  10: async_std::task::builder::Builder::blocking\\n  11: query_engine::main\\n  12: std::sys_common::backtrace::__rust_begin_short_backtrace\\n  13: std::rt::lang_start::{{closure}}\\n  14: core::ops::function::impls::<impl core::ops::function::FnOnce<A> for &F>::call_once\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/core/src/ops/function.rs:259:13\\n      std::panicking::try::do_call\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:403:40\\n      std::panicking::try\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:367:19\\n      std::panic::catch_unwind\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panic.rs:133:14\\n      std::rt::lang_start_internal::{{closure}}\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/rt.rs:128:48\\n      std::panicking::try::do_call\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:403:40\\n      std::panicking::try\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panicking.rs:367:19\\n      std::panic::catch_unwind\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/panic.rs:133:14\\n      std::rt::lang_start_internal\\n             at /rustc/f1edd0429582dd29cccacaf50fd134b05593bd9c/library/std/src/rt.rs:128:20\\n  15: main\\n  16: __libc_start_main\\n  17: <unknown>\\n"}\r\n',
      ])
    }
  })

  test('serialization of 400 includes default message if it is not a known error', async () => {
    expect.assertions(2)

    try {
      await responseToError(response(''), '')
    } catch (error) {
      expect(error.message).toEqual('This request could not be understood by the server')
      expect(error.code).toEqual('P5000')
    }
  })

  test('serialization of 400 includes original cause from data proxy if it is a known error', async () => {
    expect.assertions(3)

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
      await responseToError(response(JSON.stringify(errorJSON)), '')
    } catch (error) {
      expect(error.constructor.name).toEqual('PrismaClientInitializationError')
      expect(error.message).toEqual(
        'Authentication failed against database server at `my-database.random-id.eu-west-1.rds.amazonaws.com`, the provided database credentials for `username` are not valid.\n\nPlease make sure to provide valid database credentials for the database server at `my-database.random-id.eu-west-1.rds.amazonaws.com`.',
      )
      expect(error.errorCode).toEqual('P1000')
    }
  })

  test('The PDP request Id is added to error messages if the header is present in the response', async () => {
    expect.assertions(1)

    const errorJSON = {
      EngineNotStarted: {
        reason: 'SchemaMissing',
      },
    }

    const error = await responseToError(response(JSON.stringify(errorJSON), 404, 'some-request-id'), '')
    if (error) {
      expect(error.message).toEqual('Schema needs to be uploaded (The request id was: some-request-id)')
    }
  })
})
