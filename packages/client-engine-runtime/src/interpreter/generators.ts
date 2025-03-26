import cuid1 from '@bugsnag/cuid'
import { createId as cuid2 } from '@paralleldrive/cuid2'
import { nanoid } from 'nanoid'
import { ulid } from 'ulid'
import { v4 as uuidv4, v7 as uuidv7 } from 'uuid'

import { PrismaValue } from '../QueryPlan'

export class GeneratorRegistry {
  #generators: GeneratorRegistrySnapshot = {}

  constructor() {
    this.register('now', new NowGenerator())
    this.register('uuid', new UuidGenerator())
    this.register('cuid', new CuidGenerator())
    this.register('ulid', new UlidGenerator())
    this.register('nanoid', new NanoIdGenerator())
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
  generate(...args: PrismaValue[]): PrismaValue
}

class NowGenerator implements ValueGenerator {
  #now: Date = new Date()

  generate(): string {
    return this.#now.toISOString()
  }
}

class UuidGenerator implements ValueGenerator {
  generate(arg: PrismaValue | undefined): string {
    if (arg === 4) {
      return uuidv4()
    } else if (arg === 7) {
      return uuidv7()
    } else {
      throw new Error('Invalid UUID generator arguments')
    }
  }
}

class CuidGenerator implements ValueGenerator {
  generate(arg: PrismaValue | undefined): string {
    if (arg === 1) {
      return cuid1()
    } else if (arg === 2) {
      return cuid2()
    } else {
      throw new Error('Invalid CUID generator arguments')
    }
  }
}

class UlidGenerator implements ValueGenerator {
  generate(): string {
    return ulid()
  }
}

class NanoIdGenerator implements ValueGenerator {
  generate(arg: PrismaValue | undefined): string {
    if (typeof arg === 'number') {
      return nanoid(arg)
    } else if (arg === undefined) {
      return nanoid()
    } else {
      throw new Error('Invalid Nanoid generator arguments')
    }
  }
}
