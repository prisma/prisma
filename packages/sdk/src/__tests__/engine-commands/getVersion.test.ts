import { enginesVersion, getCliQueryEngineType } from '@prisma/engines'

import { EngineType, getVersion } from '../..'

const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineType() === EngineType.libqueryEngine

describe('getVersion', () => {
  test('Introspection Engine', async () => {
    const introspectionEngineVersion = await getVersion(undefined, EngineType.introspectionEngine)
    expect(introspectionEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Migration Engine', async () => {
    const migrationEngineVersion = await getVersion(undefined, EngineType.migrationEngine)
    expect(migrationEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Prisma Fmt', async () => {
    const prismaFmtVersion = await getVersion(undefined, EngineType.prismaFmt)
    expect(prismaFmtVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  testIf(!useNodeAPI)('Query Engine', async () => {
    const queryEngineVersion = await getVersion(undefined, EngineType.queryEngine)
    expect(queryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
  testIf(useNodeAPI)('Query Engine (Node-API)', async () => {
    const libqueryEngineVersion = await getVersion(undefined, EngineType.libqueryEngine)
    expect(libqueryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
})
