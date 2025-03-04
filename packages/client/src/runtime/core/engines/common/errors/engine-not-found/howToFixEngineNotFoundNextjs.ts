import type { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'

export function howToFixEngineNotFoundNextjs(input: EngineNotFoundErrorInput) {
  const { errorStack } = input

  if (errorStack?.match(/\/\.next|\/next@|\/next\//)) {
    return '\n\nWe detected that you are using Next.js, learn how to fix this: https://pris.ly/d/engine-not-found-nextjs.'
  }

  return ''
}
