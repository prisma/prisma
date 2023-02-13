import { EventEmitter } from 'events'

import { PrismaClientInitializationError } from '../common/errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../common/errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../common/errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../common/errors/PrismaClientUnknownRequestError'
import { LibraryEngine } from '../library/LibraryEngine'
import { LibraryLoader } from '../library/types/Library'

function setupMockLibraryEngine() {
  const rustEngineMock = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue('{}'),
    sdlSchema: jest.fn().mockResolvedValue(''),
    startTransaction: jest.fn().mockResolvedValue('{}'),
    commitTransaction: jest.fn().mockResolvedValue('{}'),
    rollbackTransaction: jest.fn().mockResolvedValue('{}'),
  }

  const loader: LibraryLoader = {
    loadLibrary() {
      return Promise.resolve({
        QueryEngine: jest.fn().mockReturnValue(rustEngineMock),
        version: jest.fn().mockResolvedValue({ commit: '123abc', version: 'mock' }),
        getConfig: jest.fn().mockResolvedValue({
          datasources: [],
          generators: [],
          warnings: [],
        }),
        dmmf: jest.fn().mockResolvedValue(undefined),
        debugPanic: jest.fn(),
      })
    },
  }

  const engine = new LibraryEngine(
    {
      datamodelPath: '/mock',
      logEmitter: new EventEmitter(),
      tracingConfig: {
        enabled: false,
        middleware: false,
      },
      env: {},
    },
    loader,
  )
  return { engine, rustEngineMock }
}

function panicError() {
  return {
    error: 'All is lost',
    user_facing_error: {
      is_panic: true,
      message: 'AAA!!!!',
    },
  }
}

function knownError() {
  return {
    error: 'It happens sometimes',
    user_facing_error: {
      error_code: 123,
      is_panic: false,
      message: 'Deal with it',
    },
  }
}

function unknownError() {
  return {
    error: 'We have no idea what happened',
    user_facing_error: {
      is_panic: false,
      message: 'And we have not much to say',
    },
  }
}

function panicException() {
  return Object.assign(new Error('PANIC: All is lost!'), { code: 'GenericFailure' })
}

jest.mock('fs', () => {
  // we need this because LibraryEngine will try to read datamodel file in the constructor
  const original = jest.requireActual('fs')
  return {
    ...original,
    readFileSync: jest.fn().mockReturnValue(''),
  }
})

test('responds to initialization error with PrismaClientInitializationError', async () => {
  const loader: LibraryLoader = {
    loadLibrary() {
      return Promise.reject(new PrismaClientInitializationError('Initialization error', '0.0.0.'))
    },
  }

  const engine = new LibraryEngine(
    {
      datamodelPath: '/mock',
      logEmitter: new EventEmitter(),
      tracingConfig: {
        enabled: false,
        middleware: false,
      },
      env: {},
    },
    loader,
  )

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toBeInstanceOf(
    PrismaClientInitializationError,
  )
})

test('responds to panic GraphQL error with PrismaClientRustPanicError', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockResolvedValue(
    JSON.stringify({
      errors: [panicError()],
    }),
  )

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toBeInstanceOf(
    PrismaClientRustPanicError,
  )
})

test('responds to panic GraphQL error with an error, containing github link', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockResolvedValue(
    JSON.stringify({
      errors: [panicError()],
    }),
  )

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toMatchObject({
    message: expect.stringContaining('https://github.com/prisma/prisma/issues'),
  })
})

test('responds to panic exception with PrismaClientRustPanicError', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockRejectedValue(panicException())

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toBeInstanceOf(
    PrismaClientRustPanicError,
  )
})

test('responds to panic exception with an error, containing github link', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockRejectedValue(panicException())

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toMatchObject({
    message: expect.stringContaining('https://github.com/prisma/prisma/issues'),
  })
})

test('responds to known error with PrismaClientKnownRequestError', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockResolvedValue(
    JSON.stringify({
      errors: [knownError()],
    }),
  )

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toBeInstanceOf(
    PrismaClientKnownRequestError,
  )
})

test('responds to unknown error with PrismaClientUnknownRequestError', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockResolvedValue(
    JSON.stringify({
      errors: [unknownError()],
    }),
  )

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toBeInstanceOf(
    PrismaClientUnknownRequestError,
  )
})

test('responds to a non panic error without github link', async () => {
  const { engine, rustEngineMock } = setupMockLibraryEngine()

  rustEngineMock.query.mockResolvedValue(
    JSON.stringify({
      errors: [knownError()],
    }),
  )

  await expect(engine.request({ query: 'query Foo { id }' }, { isWrite: false })).rejects.toMatchObject({
    message: expect.not.stringContaining('https://github.com/'),
  })
})
