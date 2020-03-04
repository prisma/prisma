import { getLogLevel } from '../runtime/getLogLevel'

test('info and warn', () => {
  const level = getLogLevel([
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ])

  expect(level).toMatchInlineSnapshot(`"info"`)
})

test('query', () => {
  const level = getLogLevel([
    {
      emit: 'event',
      level: 'query',
    },
  ])

  expect(level).toMatchInlineSnapshot(`undefined`)
})

test('strings and objects', () => {
  const level = getLogLevel([
    {
      emit: 'event',
      level: 'query',
    },
    'warn',
  ])

  expect(level).toMatchInlineSnapshot(`"warn"`)
})
