import { BinaryType } from '@prisma/fetch-engine'
import * as E from 'fp-ts/Either'

import { loadNodeAPILibrary } from '../../engine-commands/queryEngineCommons'
import { resolveBinary } from '../../resolveBinary'
import * as loadUtils from '../../utils/load'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE !== 'binary')('loadNodeAPILibrary', () => {
  it('error path', async () => {
    const spyLoadTag = 'error-load'
    const spyLoad = jest.spyOn(loadUtils, 'load').mockImplementation((id: string) => {
      throw new Error(spyLoadTag)
    })

    try {
      const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine)
      const result = await loadNodeAPILibrary(queryEnginePath)()

      expect(E.isLeft(result)).toBe(true)

      if (E.isLeft(result)) {
        expect(result.left.type).toEqual('connection-error')
        expect(result.left.reason).toEqual('Unable to establish a connection to query-engine-node-api library.')
        expect(result.left.error).toBeTruthy()
      }
    } finally {
      spyLoad.mockRestore()
    }
  })

  it('error path, openssl', async () => {
    const spyLoadTag = 'error-load, something something openssl installation'
    const spyLoad = jest.spyOn(loadUtils, 'load').mockImplementation((id: string) => {
      throw new Error(spyLoadTag)
    })

    try {
      const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine)
      const result = await loadNodeAPILibrary(queryEnginePath)()

      expect(E.isLeft(result)).toBe(true)

      if (E.isLeft(result)) {
        expect(result.left.type).toEqual('connection-error')
        expect(result.left.reason).toEqual(
          `Unable to establish a connection to query-engine-node-api library. It seems there is a problem with your OpenSSL installation!`,
        )
        expect(result.left.error).toBeTruthy()
      }
    } finally {
      spyLoad.mockRestore()
    }
  })

  it('happy path', async () => {
    const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine)
    const result = await loadNodeAPILibrary(queryEnginePath)()

    expect(E.isRight(result)).toBe(true)

    if (E.isRight(result)) {
      expect(result.right.NodeAPIQueryEngineLibrary).toBeTruthy()
    }
  })
})
