// Prevent postinstall script from running
process.env.SKIP_GENERATE = 'true'

import {
  ERROR_WHILE_FINDING_POSTINSTALL_TRIGGER,
  getPostInstallTrigger,
} from '../../../scripts/postinstall'

test('it joins the argv array of strings input into one single string ', () => {
  process.env.npm_config_argv = '{"original":["foo", "bar"]}'
  expect(getPostInstallTrigger()).toEqual('foo bar')
})

test('empty array results in empty string', () => {
  process.env.npm_config_argv = '{"original":[]}'
  expect(getPostInstallTrigger()).toEqual('')
})

test('empty array results in empty string', () => {
  process.env.npm_config_argv = '{"original":[]}'
  expect(getPostInstallTrigger()).toEqual('')
})

describe('fails gracefully with', () => {
  test.each([
    ['envar missing', undefined],
    ['envar bad json', 'bah'],
    ['envar bad json schema missing field', '{}'],
    ['envar bad json schema bad field type', '{"original":1}'],
  ])('%s', (_, envVarValue) => {
    process.env.npm_config_argv = envVarValue
    expect(getPostInstallTrigger()).toEqual(
      ERROR_WHILE_FINDING_POSTINSTALL_TRIGGER,
    )
  })
})
