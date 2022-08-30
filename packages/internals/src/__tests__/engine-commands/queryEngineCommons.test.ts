import { BinaryType } from '@prisma/fetch-engine'
import * as E from 'fp-ts/Either'
import os from 'os'
import stripAnsi from 'strip-ansi'

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
    const spyLoadTag = `Unable to require(\`/app/node_modules/.pnpm/prisma@x.x.x/node_modules/prisma/libquery_engine-debian-openssl-1.1.x.so.node\`)
libssl.so.1.1: cannot open shared object file: No such file or directory`

    const spyLoad = jest.spyOn(loadUtils, 'load').mockImplementation((id: string) => {
      throw new Error(spyLoadTag)
    })

    try {
      const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine)
      const result = await loadNodeAPILibrary(queryEnginePath)()

      expect(E.isLeft(result)).toBe(true)

      if (E.isLeft(result)) {
        expect(result.left.type).toEqual('connection-error')
        expect(stripAnsi(result.left.reason)).toEqual(
          `Unable to establish a connection to query-engine-node-api library. It seems there is a problem with your OpenSSL installation!`,
        )
        expect(result.left.error).toBeTruthy()
      }
    } finally {
      spyLoad.mockRestore()
    }
  })

  it('error path, architecture or libc', async () => {
    const spyLoadTag = `Unable to require(\`/app/node_modules/.pnpm/prisma@x.x.x/node_modules/prisma/libquery_engine-linux-arm64-openssl-1.1.x.so.node\`)
Error relocating /app/node_modules/.pnpm/prisma@x.x.x/node_modules/prisma/libquery_engine-linux-arm64-openssl-1.1.x.so.node: __res_init: symbol not found`

    const spyLoad = jest.spyOn(loadUtils, 'load').mockImplementation((id: string) => {
      throw new Error(spyLoadTag)
    })

    try {
      const queryEnginePath = await resolveBinary(BinaryType.libqueryEngine)
      const result = await loadNodeAPILibrary(queryEnginePath)()

      expect(E.isLeft(result)).toBe(true)

      if (E.isLeft(result)) {
        expect(result.left.type).toEqual('connection-error')
        expect(stripAnsi(result.left.reason)).toEqual(
          `Unable to establish a connection to query-engine-node-api library. It seems that the current architecture ${os.arch()} is not supported, or that libc is missing from the system.`,
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
      expect(result.right.NodeAPIQueryEngineLibrary.QueryEngine).toBeTruthy()
    }
  })
})
