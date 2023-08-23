import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'

import { BinaryType, getEngineVersion } from '../..'

const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineBinaryType() === BinaryType.QueryEngineLibrary

describe('getEngineVersion', () => {
  test('Schema Engine', async () => {
    const schemaEngineVersion = await getEngineVersion(undefined, BinaryType.SchemaEngineBinary)
    expect(schemaEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  testIf(!useNodeAPI)('Query Engine', async () => {
    const queryEngineVersion = await getEngineVersion(undefined, BinaryType.QueryEngineBinary)
    expect(queryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
  testIf(useNodeAPI)('Query Engine (Node-API)', async () => {
    const libqueryEngineVersion = await getEngineVersion(undefined, BinaryType.QueryEngineLibrary)
    expect(libqueryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
})
