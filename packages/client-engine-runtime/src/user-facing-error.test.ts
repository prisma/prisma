import { expect, test } from 'vitest'

import { rethrowAsUserFacing } from './user-facing-error'

function makeDriverAdapterError(cause: object) {
  // Minimal shape that satisfies isDriverAdapterError + rethrowAsUserFacing
  return {
    name: 'DriverAdapterError',
    message: 'driver adapter error',
    cause,
  }
}

test('rethrowAsUserFacing re-throws the original error for unknown cause kinds', () => {
  // An unknown `kind` value simulates a driver-adapter version that is ahead
  // of the client (new error variant not yet handled by getErrorCode /
  // renderErrorMessage). Before the fix the thrown message contained
  // "[object Object]"; after the fix it contains a JSON-serialised snapshot.
  const error = makeDriverAdapterError({ kind: 'SomeNewUnknownErrorKind', detail: 'more info' })

  expect(() => rethrowAsUserFacing(error)).toThrowError(/Unknown error: .*SomeNewUnknownErrorKind/)

  // Crucially the message must NOT degrade to the useless "[object Object]"
  expect(() => rethrowAsUserFacing(error)).not.toThrowError('[object Object]')
})

test('rethrowAsUserFacing wraps postgres errors as P2010 with formatted message', () => {
  const error = makeDriverAdapterError({
    kind: 'postgres',
    originalCode: 'P0001',
    originalMessage: 'Trigger violation',
  })

  try {
    rethrowAsUserFacing(error)
  } catch (e: any) {
    // Verify the Prisma P-code
    expect(e.code).toBe('P2010')
    
    // Verify the formatted message matches the $queryRaw path
    expect(e.message).toBe('Raw query failed. Code: `P0001`. Message: `Trigger violation`')
    
    // Verify the original error is attached in meta
    expect(e.meta).toMatchObject({
      driverAdapterError: error,
    })
  }
})
