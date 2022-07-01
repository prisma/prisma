import { enginesVersion, getCliQueryEngineType } from '@prisma/engines'

import { EngineTypeEnum, getEngineVersion } from '../..'

const testIf = (condition: boolean) => (condition ? test : test.skip)
const useNodeAPI = getCliQueryEngineType() === EngineTypeEnum.libqueryEngine

describe('getEngineVersion', () => {
  test('Introspection Engine', async () => {
    const introspectionEngineVersion = await getEngineVersion(undefined, EngineTypeEnum.introspectionEngine)
    expect(introspectionEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Migration Engine', async () => {
    const migrationEngineVersion = await getEngineVersion(undefined, EngineTypeEnum.migrationEngine)
    expect(migrationEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  test('Prisma Fmt', async () => {
    const prismaFmtVersion = await getEngineVersion(undefined, EngineTypeEnum.prismaFmt)
    expect(prismaFmtVersion.split(' ')[1]).toMatch(enginesVersion)
  })

  testIf(!useNodeAPI)('Query Engine', async () => {
    const queryEngineVersion = await getEngineVersion(undefined, EngineTypeEnum.queryEngine)
    expect(queryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
  testIf(useNodeAPI)('Query Engine (Node-API)', async () => {
    const libqueryEngineVersion = await getEngineVersion(undefined, EngineTypeEnum.libqueryEngine)
    expect(libqueryEngineVersion.split(' ')[1]).toMatch(enginesVersion)
  })
})
