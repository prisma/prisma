// Prevent postinstall script from running
process.env.SKIP_GENERATE = 'true'

import {
  getPostInstallTrigger,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_PARSE_ERROR,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER__EMPTY_STRING,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER__ENVAR_MISSING,
} from '../../../scripts/postinstall'

test('it joins the argv array of strings input into one single string ', () => {
  process.env.npm_config_argv = '{"original":["foo", "bar"]}'
  expect(getPostInstallTrigger()).toEqual('foo bar')
})

describe('fails gracefully with', () => {
  // prettier-ignore
  test.each([
    ['envar missing', undefined, UNABLE_TO_FIND_POSTINSTALL_TRIGGER__ENVAR_MISSING],
    ['envar bad json', 'bah', UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_PARSE_ERROR +': bah'],
    [ 'envar bad json schema missing field', '{}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR+': {}'],
    [ 'envar bad json schema bad field type', '{"original":1}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR+': {"original":1}'],
    ['empty original argv array', '{"original":[]}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER__EMPTY_STRING+': {"original":[]}'],
    ['empty strings in original argv array', '{"original":["",""]}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER__EMPTY_STRING+': {"original":["",""]}'],
  ])('%s', (_, envVarValue, expected) => {
    if (envVarValue === undefined) {
       delete process.env.npm_config_argv
     } else  {
       process.env.npm_config_argv = envVarValue
     }
    expect(getPostInstallTrigger()).toEqual(
      expected,
    )
  })
})
