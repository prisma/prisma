// Prevent postinstall script from running
process.env.SKIP_GENERATE = 'true'

import {
  getPostInstallTrigger,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER__EMPTY_STRING,
} from '../../../scripts/postinstall'

test('it joins the argv array of strings input into one single string ', () => {
  process.env.npm_config_argv = '{"original":["foo", "bar"]}'
  expect(getPostInstallTrigger()).toEqual('foo bar')
})

describe('fails gracefully with', () => {
  // prettier-ignore
  test.each([
    ['envar missing', undefined, UNABLE_TO_FIND_POSTINSTALL_TRIGGER],
    ['envar bad json', 'bah', UNABLE_TO_FIND_POSTINSTALL_TRIGGER],
    [ 'envar bad json schema missing field', '{}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER],
    [ 'envar bad json schema bad field type', '{"original":1}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER],
    ['empty original argv array', '{"original":[]}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER__EMPTY_STRING],
    ['empty strings in original argv array', '{"original":["",""]}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER__EMPTY_STRING],
  ])('%s', (_, envVarValue, expected) => {
    process.env.npm_config_argv = envVarValue
    expect(getPostInstallTrigger()).toEqual(
      expected,
    )
  })
})
