// Prevent postinstall script from running
process.env.SKIP_GENERATE = 'true'
// Prevent way test suite is run to affect test outcomes
process.env.npm_config_user_agent = 'npm/1.2.3'

import {
  getPostInstallTrigger,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_PARSE_ERROR,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER__ENVAR_MISSING,
} from '../../../scripts/postinstall'

test('joins the argv array of strings input into one single string', () => {
  process.env.npm_config_argv = '{"original":["foo", "bar"]}'
  expect(getPostInstallTrigger()).toEqual('npm foo bar')
})

test('empty original argv array results in just the package manager name as the command', () => {
  process.env.npm_config_argv = '{"original":[]}'
  expect(getPostInstallTrigger()).toEqual('npm')
})

describe('npm_config_user_agent', () => {
  beforeEach(() => {
    process.env.npm_config_argv = '{"original":["foo", "bar"]}'
  })
  test.each([['yarn'], ['npm'], ['pnpm'], ['qux']])(
    'gets package manager name from npm_config_user_agent when matching userAgent pattern e.g. for %s',
    (name) => {
      process.env.npm_config_user_agent = `${name}/1.2.3`
      expect(getPostInstallTrigger()).toEqual(`${name} foo bar`)
    },
  )

  test('if npm_config_user_agent not available then falls back to MISSING_NPM_CONFIG_USER_AGENT', () => {
    delete process.env.npm_config_user_agent
    expect(getPostInstallTrigger()).toEqual(
      `MISSING_NPM_CONFIG_USER_AGENT foo bar`,
    )
  })

  test('if npm_config_user_agent not parsable then falls back to UNKNOWN_NPM_CONFIG_USER_AGENT', () => {
    process.env.npm_config_user_agent = `foo@1.2.3`
    expect(getPostInstallTrigger()).toEqual(
      `UNKNOWN_NPM_CONFIG_USER_AGENT(foo@1.2.3) foo bar`,
    )
  })
})

describe('fails gracefully with', () => {
  // prettier-ignore
  test.each([
    ['envar missing', undefined, UNABLE_TO_FIND_POSTINSTALL_TRIGGER__ENVAR_MISSING],
    ['envar bad json', 'bah', UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_PARSE_ERROR +': bah'],
    ['envar bad json schema missing field', '{}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR+': {}'],
    ['envar bad json schema bad field type', '{"original":1}', UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR+': {"original":1}'],
  ])('%s', (_, envVarValue, expected) => {
    if (envVarValue === undefined) {
       delete process.env.npm_config_argv
     } else  {
       process.env.npm_config_argv = envVarValue
     }
    expect(getPostInstallTrigger()).toEqual(expected)
  })
})
