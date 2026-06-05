import { RequestHandler } from './RequestHandler'

test('unpack preserves native JSON values when deserialization is skipped', () => {
  const handler = Object.create(RequestHandler.prototype) as RequestHandler
  const jsonValue = { $type: 'DateTime', value: 'not a protocol value' }

  expect(handler.unpack({ findUnique: jsonValue }, [], undefined, true)).toBe(jsonValue)
  expect(
    handler.unpack(
      {
        findUnique: { $type: 'Json', value: JSON.stringify(jsonValue) },
      },
      [],
    ),
  ).toEqual(jsonValue)
})
