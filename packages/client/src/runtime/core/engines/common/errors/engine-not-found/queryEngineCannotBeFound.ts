import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'

export function queryEngineCannotBeFound(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `Prisma Client could not locate the Query Engine file called "${runtimeBinaryTarget}".`
}
