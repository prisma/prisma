import { defaultTestConfig } from '@prisma/config'

import { Completions, parseCompletionCommand } from './Completions'

type CliDistributionIdentity = 'prisma' | 'prisma7'

type ShellContract = {
  shell: 'fish' | 'bash' | 'zsh' | 'powershell'
  registrationPattern: (identity: CliDistributionIdentity) => RegExp
}

const shellContracts: readonly ShellContract[] = [
  {
    shell: 'fish',
    registrationPattern: (identity) => new RegExp(`^complete -c ${identity}(\\s|$)`, 'm'),
  },
  {
    shell: 'bash',
    registrationPattern: (identity) => new RegExp(`^complete -F __${identity}_complete ${identity}$`, 'm'),
  },
  {
    shell: 'zsh',
    registrationPattern: (identity) => new RegExp(`^#compdef ${identity}$`, 'm'),
  },
  {
    shell: 'powershell',
    registrationPattern: (identity) => new RegExp(`^Register-ArgumentCompleter -CommandName '${identity}'`, 'm'),
  },
] as const

const parseCompletionCommandWithIdentity = parseCompletionCommand as (
  argv: string[],
  identity?: CliDistributionIdentity,
) => string | Error

function captureCompletionOutput(
  argv: string[],
  identity?: CliDistributionIdentity,
): { result: string | Error; output: string[] } {
  const output: string[] = []
  const consoleLog = jest.spyOn(console, 'log').mockImplementation((value) => output.push(String(value)))

  try {
    return { result: parseCompletionCommandWithIdentity(argv, identity), output }
  } finally {
    consoleLog.mockRestore()
  }
}

describe('completion command', () => {
  test('completes top-level commands', () => {
    const { result, output } = captureCompletionOutput(['--', 'g'])

    expect(result).toBe('')
    expect(output).toEqual(['generate\tGenerate artifacts (e.g. Prisma Client)', ':4'])
  })

  test('completes nested commands', () => {
    const { result, output } = captureCompletionOutput(['--', 'migrate', 'd'])

    expect(result).toBe('')
    expect(output).toEqual([
      'dev\tCreate and apply migrations in development',
      'deploy\tApply pending migrations to the database',
      'diff\tCompare the database schema from two arbitrary sources',
      ':4',
    ])
  })

  test('completes option values', () => {
    const { result, output } = captureCompletionOutput(['--', 'generate', '--schema', ''])

    expect(result).toBe('')
    expect(output).toEqual([
      'prisma/schema.prisma\tDefault schema path',
      './schema.prisma\tSchema in project root',
      ':4',
    ])
  })

  test('generates the existing fish integration script for prisma', () => {
    const { result, output } = captureCompletionOutput(['fish'])

    expect(result).toBe('')
    expect(output).toHaveLength(1)
    expect(output[0]).toContain('prisma complete -- $args[2..-1] "$lastArg"')
    expect(output[0]).toContain('complete -c prisma')
  })

  describe.each([
    { identity: 'prisma' as const, otherIdentity: 'prisma7' as const },
    { identity: 'prisma7' as const, otherIdentity: 'prisma' as const },
  ])('identity-aware shell setup for $identity', ({ identity, otherIdentity }) => {
    test.each(shellContracts)(
      '$shell uses the selected executable in generated setup',
      ({ shell, registrationPattern }) => {
        const { result, output } = captureCompletionOutput([shell], identity)

        expect(result).toBe('')
        expect(output).toHaveLength(1)
        expect(output[0]).toContain(`${identity} complete`)
        expect(output[0]).toMatch(registrationPattern(identity))
        expect(output[0]).not.toContain(`${otherIdentity} complete`)
        expect(output[0]).not.toMatch(registrationPattern(otherIdentity))
      },
    )

    test('Completions forwards the selected identity', async () => {
      const output: string[] = []
      const consoleLog = jest.spyOn(console, 'log').mockImplementation((value) => output.push(String(value)))

      try {
        const result = await Completions.new(identity).parse(['fish'], defaultTestConfig())

        expect(result).toBe('')
        expect(output).toHaveLength(1)
        expect(output[0]).toMatch(new RegExp(`^complete -c ${identity}(\\s|$)`, 'm'))
        expect(output[0]).toContain(`${identity} complete`)
        expect(output[0]).not.toMatch(new RegExp(`^complete -c ${otherIdentity}(\\s|$)`, 'm'))
      } finally {
        consoleLog.mockRestore()
      }
    })
  })

  test('completion bundle infers prisma7 independently from the executable path', () => {
    const previousArgv = process.argv
    process.argv = ['/usr/bin/node', '/tmp/prisma7', 'complete', 'fish']

    try {
      const { result, output } = captureCompletionOutput(['fish'])

      expect(result).toBe('')
      expect(output).toHaveLength(1)
      expect(output[0]).toContain('prisma7 complete')
      expect(output[0]).toMatch(/^complete -c prisma7(\s|$)/m)
      expect(output[0]).not.toMatch(/^complete -c prisma(\s|$)/m)
    } finally {
      process.argv = previousArgv
    }
  })

  test('rejects unsupported shells', () => {
    const { result, output } = captureCompletionOutput(['unsupported'])

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Invalid shell type. Must be one of: zsh, bash, fish, powershell')
    expect(output).toEqual([])
  })
})
