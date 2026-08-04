import { structuredError } from '@internal/utils/structured-error';
import type { MongoCodec } from './codecs';

export interface MongoCodecRegistry {
  get(id: string): MongoCodec<string> | undefined;
  has(id: string): boolean;
  register(codec: MongoCodec<string>): void;
  [Symbol.iterator](): Iterator<MongoCodec<string>>;
  values(): IterableIterator<MongoCodec<string>>;
}

/**
 * Create a new Mongo codec registry. Inline object literal — no class implementation; the registry is just a private `Map` with the documented surface methods.
 */
export function newMongoCodecRegistry(): MongoCodecRegistry {
  const byId = new Map<string, MongoCodec<string>>();
  return {
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    register: (codec) => {
      if (byId.has(codec.id)) {
        throw structuredError(
          'RUNTIME.DUPLICATE_CODEC',
          `Codec with ID '${codec.id}' is already registered`,
        );
      }
      byId.set(codec.id, codec);
    },
    values: () => byId.values(),
    [Symbol.iterator]: function* () {
      yield* byId.values();
    },
  };
}
