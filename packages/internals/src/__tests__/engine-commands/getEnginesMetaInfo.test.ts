import { getEnginesInfo } from '../../engine-commands/getEnginesMetaInfo'

describe('getEnginesInfo', () => {
  it('should return the absolute path of the engine', () => {
    const [versionMessage, errors] = getEnginesInfo({
      path: {
        _tag: 'Right',
        right: '/path/to/prisma/packages/engines/libquery_engine-debian-openssl-3.0.x.so.node',
      },
      version: {
        _tag: 'Right',
        right: 'libquery_engine 6473dadba8a7fff9689b35ad2ca9f9e5aff4d0d0',
      },
      fromEnvVar: { _tag: 'None' },
    })

    expect(errors).toEqual([])
    expect(versionMessage).toBe(
      'libquery_engine 6473dadba8a7fff9689b35ad2ca9f9e5aff4d0d0 (at /path/to/prisma/packages/engines/libquery_engine-debian-openssl-3.0.x.so.node)',
    )
  })
})
