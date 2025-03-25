import { randomUUID } from '../crypto'
import { PrismaValue } from '../QueryPlan'

export class GeneratorRegistry {
  #generators: GeneratorRegistrySnapshot

  constructor() {
    this.#generators = {}
    this.register('uuid', new UuidGenerator())
  }

  /**
   * Returns a snapshot of the generator registry. It's 'frozen' in time at the moment of being
   * called, meaning that the built-in time-based generators will always return the same value
   * on repeated calls as long as the same snapshot is used.
   */
  snapshot(): Readonly<GeneratorRegistrySnapshot> {
    return Object.create(this.#generators, {
      now: { value: new NowGenerator() },
    })
  }

  /**
   * Registers a new generator with the given name.
   */
  register(name: string, generator: ValueGenerator): void {
    this.#generators[name] = generator
  }
}

export interface GeneratorRegistrySnapshot {
  [key: string]: ValueGenerator
}

export interface ValueGenerator {
  generate(args: PrismaValue[]): Promise<PrismaValue>
}

class UuidGenerator implements ValueGenerator {
  generate(): Promise<string> {
    return Promise.resolve(randomUUID())
  }
}

class NowGenerator implements ValueGenerator {
  #now: Date = new Date()

  generate(): Promise<string> {
    return Promise.resolve(this.#now.toDateString())
  }
}
