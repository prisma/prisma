import path from 'node:path'

import { execaSync } from 'execa'

const packageRoot = path.resolve(__dirname, '..', '..')
type TestRuntime = 'node' | 'bun'

export class JestCli {
  constructor(
    private args: string[] = [],
    private env: Record<string, string> = {},
    private path = 'node_modules/.bin/jest',
    private runtime: TestRuntime = 'node',
  ) {}

  withArgs(args: string[]): JestCli {
    return new JestCli([...this.args, ...args], this.env, this.path, this.runtime)
  }

  withEnv(env: Record<string, string>): JestCli {
    return new JestCli(this.args, { ...this.env, ...env }, this.path, this.runtime)
  }

  withRuntime(runtime: TestRuntime): JestCli {
    return new JestCli(this.args, this.env, this.path, runtime)
  }

  withDebugger(): JestCli {
    const args = ['--inspect-brk', 'node_modules/jest/bin/jest.js', ...this.args]
    const cli = new JestCli(args, this.env, 'node')
    return cli
  }

  run(): void {
    const command = this.runtime === 'bun' ? 'bun' : this.path
    const args = this.runtime === 'bun' ? ['x', 'jest', ...this.args] : this.args

    execaSync(command, args, {
      env: this.env,
      stdio: 'inherit',
      cwd: packageRoot,
    })
  }
}
