import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'

import { BinaryType, getEngineVersion } from '../..'

const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineBinaryType() === BinaryType.libqueryEngine

describe('getEngineVersion', () => {
  test('Migration Engine', async () => {
    const migrationEngineVersion = await getEngineVersion(undefined, BinaryType.migrationEngine)
    expect(migrationEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Prisma Fmt', async () => {
    const prismaFmtVersion = await getEngineVersion(undefined, BinaryType.prismaFmt)
    expect(prismaFmtVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  testIf(!useNodeAPI)('Query Engine', async () => {
    const queryEngineVersion = await getEngineVersion(undefined, BinaryType.queryEngine)
    expect(queryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
  testIf(useNodeAPI)('Query Engine (Node-API)', async () => {
    const libqueryEngineVersion = await getEngineVersion(undefined, BinaryType.libqueryEngine)
    expect(libqueryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
})
