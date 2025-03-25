import { GeneratorRegistry } from './generators'

test('should always return the snapshot time', async () => {
  const registry = await GeneratorRegistry.createWithDefaults()
  const snapshot = registry.snapshot()
  const time1 = snapshot.now.generate([])
  await new Promise((resolve) => setTimeout(resolve, 10))
  const time2 = snapshot.now.generate([])

  expect(time1).toBe(time2)
})

test('should return different times for different snapshots', async () => {
  const registry = await GeneratorRegistry.createWithDefaults()
  const time1 = registry.snapshot().now.generate([])
  await new Promise((resolve) => setTimeout(resolve, 10))
  const time2 = registry.snapshot().now.generate([])

  expect(time1).not.toBe(time2)
})

test('should generate different UUIDs', async () => {
  const registry = await GeneratorRegistry.createWithDefaults()
  const snapshot = registry.snapshot()

  const uuid1 = snapshot.uuid.generate([])
  const uuid2 = snapshot.uuid.generate([])
  expect(uuid1).not.toBe(uuid2)
})
