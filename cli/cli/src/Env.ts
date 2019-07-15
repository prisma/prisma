/**
 * Environment to load
 *
 */
export class Env {
  static async load(env: NodeJS.ProcessEnv, cwd: string): Promise<Error | Env> {
    return new Env(env, cwd)
  }
  private constructor(public readonly env: NodeJS.ProcessEnv, public readonly cwd: string) {}
}
