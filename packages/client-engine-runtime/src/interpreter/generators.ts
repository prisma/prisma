import { Crypto, getCrypto } from '../crypto'
import { PrismaValue } from '../QueryPlan'

export class GeneratorRegistry {
  #generators: GeneratorRegistrySnapshot = {}

  static async createWithDefaults(): Promise<GeneratorRegistry> {
    const crypto = await getCrypto()

    const registry = new GeneratorRegistry()
    registry.register('now', new NowGenerator())
    registry.register('uuid', new UuidGenerator(crypto))
    return registry
  }

  /**
   * Returns a snapshot of the generator registry. It's 'frozen' in time at the moment of this
   * method being called, meaning that the built-in time-based generators will always return
   * the same value on repeated calls as long as the same snapshot is used.
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
  generate(args: PrismaValue[]): PrismaValue
}

class NowGenerator implements ValueGenerator {
  #now: Date = new Date()

  generate(): string {
    return this.#now.toISOString()
  }
}

class UuidGenerator implements ValueGenerator {
  #crypto: Crypto

  constructor(crypto: Crypto) {
    this.#crypto = crypto
  }

  generate(): string {
    return this.#crypto.randomUUID()
  }
}
