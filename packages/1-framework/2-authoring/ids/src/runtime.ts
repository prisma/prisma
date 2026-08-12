import type { GeneratedValueSpec } from '@internal/contract/types';
import { InternalError } from '@internal/utils/internal-error';
import type { BuiltinGeneratorId } from './generator-ids';
import { idGenerators } from './generators';

function isBuiltinGeneratorId(id: string): id is BuiltinGeneratorId {
  return Object.hasOwn(idGenerators, id);
}

export function generateId(spec: GeneratedValueSpec): string {
  if (!isBuiltinGeneratorId(spec.id)) {
    throw new InternalError(`Unknown built-in ID generator "${spec.id}".`);
  }
  return idGenerators[spec.id](spec.params);
}
