import { semverLt } from '../../../get-generators/generatorResolvers/prisma-client-js/check-dependencies/semverLt'

describe('compare semverLt as numbers', () => {
  test('compare semverLt version is working correct', () => {
    // compare semverLt as Number not as Strings. '5' > '10' is true in Strings
    const minVersion = '1.1.10'
    const testVersion = '1.1.5'
    // semverLt returns true if currentVersion is lower than the minVersion
    const results = semverLt(testVersion, minVersion)
    expect(results).toBe(true)
  })
})
