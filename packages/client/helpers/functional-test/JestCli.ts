import execa from 'execa'
import path from 'path'

const packageRoot = path.resolve(__dirname, '..', '..')
const jestPath = path.join(packageRoot, 'node_modules', '.bin', 'jest')
export class JestCli {
  private args: string[]
  private env: Record<string, string>

  constructor(args: string[] = [], env: Record<string, string> = {}) {
    this.args = args
    this.env = env
  }

  withArgs(args: string[]): JestCli {
    return new JestCli([...this.args, ...args], this.env)
  }

  withEnv(env: Record<string, string>): JestCli {
    return new JestCli(this.args, { ...this.env, ...env })
  }

  run(): void {
    execa.sync(jestPath, this.args, {
      env: this.env,
      stdio: 'inherit',
      cwd: packageRoot,
    })
  }
}
