import { DataLoader } from './DataLoader'

test('loads non-batchable requests immediately', async () => {
  const singleLoader = jest.fn((request: string) => Promise.resolve(`${request}-single`))
  const batchLoader = jest.fn((requests: string[]) => Promise.resolve(requests.map((request) => `${request}-batch`)))

  const loader = new DataLoader<string>({
    singleLoader,
    batchLoader,
    batchBy: () => undefined,
    batchOrder: () => 0,
  })

  await expect(loader.request('a')).resolves.toBe('a-single')
  expect(singleLoader).toHaveBeenCalledTimes(1)
  expect(batchLoader).not.toHaveBeenCalled()
})

test('batches requests made in the same turn', async () => {
  const singleLoader = jest.fn((request: string) => Promise.resolve(`${request}-single`))
  const batchLoader = jest.fn((requests: string[]) => Promise.resolve(requests.map((request) => `${request}-batch`)))

  const loader = new DataLoader<string>({
    singleLoader,
    batchLoader,
    batchBy: () => 'batch',
    batchOrder: () => 0,
  })

  const first = loader.request('a')
  const second = loader.request('b')

  await expect(Promise.all([first, second])).resolves.toEqual(['a-batch', 'b-batch'])
  expect(singleLoader).not.toHaveBeenCalled()
  expect(batchLoader).toHaveBeenCalledWith(['a', 'b'])
})

test('does not batch requests separated by an await', async () => {
  const singleLoader = jest.fn((request: string) => Promise.resolve(`${request}-single`))
  const batchLoader = jest.fn((requests: string[]) => Promise.resolve(requests.map((request) => `${request}-batch`)))

  const loader = new DataLoader<string>({
    singleLoader,
    batchLoader,
    batchBy: () => 'batch',
    batchOrder: () => 0,
  })

  const first = loader.request('a')
  await Promise.resolve()
  const second = loader.request('b')

  await expect(Promise.all([first, second])).resolves.toEqual(['a-single', 'b-single'])
  expect(singleLoader).toHaveBeenCalledTimes(2)
  expect(batchLoader).not.toHaveBeenCalled()
})
