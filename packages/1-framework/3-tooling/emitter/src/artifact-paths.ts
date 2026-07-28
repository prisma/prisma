import { emitterError } from './emitter-errors';

const JSON_EXTENSION = '.json';

export interface EmittedArtifactPaths {
  readonly jsonPath: string;
  readonly dtsPath: string;
}

export function getEmittedArtifactPaths(outputJsonPath: string): EmittedArtifactPaths {
  if (!outputJsonPath.endsWith(JSON_EXTENSION)) {
    throw emitterError('CONFIG.VALIDATION_FAILED', 'Contract output path must end with .json', {
      meta: { field: 'contract.output', outputJsonPath },
    });
  }

  return {
    jsonPath: outputJsonPath,
    dtsPath: `${outputJsonPath.slice(0, -JSON_EXTENSION.length)}.d.ts`,
  };
}
