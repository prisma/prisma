// Prevent postinstall script from running
import {
  getPostInstallTrigger,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER__ENVAR_MISSING,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_PARSE_ERROR,
  UNABLE_TO_FIND_POSTINSTALL_TRIGGER_JSON_SCHEMA_ERROR,
} from '../../scripts/postinstall'

process.env.PRISMA_SKIP_POSTINSTALL_GENERATE = 'true'

beforeEach(() => {
  process.env.npm_config_user_agent = 'npm/1.2.3'
  process.env.npm_config_argv = '{"original":["foo", "bar"]}'
})

test('joins the argv array of strings input into one single string', () => {
  expect(getPostInstallTrigger()).toEqual('npm foo bar')
})

test('empty original argv array results in just the package manager name as the command', () => {
  process.env.npm_config_argv = '{"original":[]}'
  expect(getPostInstallTrigger()).toEqual('npm')
})

describe('npm_config_user_agent', () => {
  test.each([['yarn'], ['npm'], ['pnpm'], ['qux']])(
    'gets package manager name from npm_config_user_agent when matching userAgent pattern e.g. for %s',
    (name) => {
      process.env.npm_config_user_agent = `${name}/1.2.3`
      expect(getPostInstallTrigger()).toEqual(`${name} foo bar`)
    },
  )

  test('trailing whitespace on command trimmed', () => {
    process.env.npm_config_user_agent = 'npm /1.2.3'
    expect(getPostInstallTrigger()).toEqual('npm foo bar')
  })
  test('leading whitespace on command trimmed', () => {
    process.env.npm_config_user_agent = '  npm/1.2.3'
    expect(getPostInstallTrigger()).toEqual('npm foo bar')
  })

  test.each([[undefined], [''], [' ']])(
    'if npm_config_user_agent not available then falls back to MISSING_NPM_CONFIG_USER_AGENT',
    (value) => {
      if (value === undefined) {
        delete process.env.npm_config_user_agent
      } else {
        process.env.npm_config_user_agent = value
      }
      delete process.env.npm_config_user_agent
      expect(getPostInstallTrigger()).toEqual(`MISSING_NPM_CONFIG_USER_AGENT foo bar`)
    },
  )

  test.each([['foo@1.2.3']])(
    'if npm_config_user_agent not parsable then falls back to UNKNOWN_NPM_CONFIG_USER_AGENT',
    (userAgentString) => {
      process.env.npm_config_user_agent = userAgentString
      expect(getPostInstallTrigger()).toEqual(`UNKNOWN_NPM_CONFIG_USER_AGENT(${userAgentString}) foo bar`)
    },
  )
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
