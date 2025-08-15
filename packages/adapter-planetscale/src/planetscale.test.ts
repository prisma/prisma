import * as planetScale from '@planetscale/database'

import { PrismaPlanetScaleAdapterFactory } from './planetscale'

describe('behavior of PrismaPlanetScaleAdapterFactory', () => {
  test('uses the provided adapter instance', async () => {
    const inst = new planetScale.Client({})
    const factory = new PrismaPlanetScaleAdapterFactory(inst)
    const spy = jest.spyOn(inst, 'execute')

    const adapter = await factory.connect()
    await adapter.queryRaw({ sql: 'SELECT 1', argTypes: [], args: [] }).catch(() => {})
    expect(spy).toHaveBeenCalledWith('SELECT 1', [], expect.anything())
  })
})
