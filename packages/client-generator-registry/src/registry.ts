import type { Generator } from '@prisma/generator'
import type { GeneratorRegistry as IGeneratorRegistry, GeneratorRegistryEntry } from '@prisma/internals'

export class GeneratorRegistry {
  #generators = new Map<string, Generator>()

  add(generator: Generator) {
    this.#generators.set(generator.name, generator)
  }

  addAliased(name: string, generator: Generator) {
    this.#generators.set(name, generator)
  }

  toInternal(): IGeneratorRegistry {
    // TODO: use iterator `map` method once we drop Node.js 18 and 20
    return Object.fromEntries(
      [...this.#generators.entries()].map(([name, generator]) => [
        name,
        {
          type: 'in-process',
          generator,
        } satisfies GeneratorRegistryEntry,
      ]),
    )
  }
}
