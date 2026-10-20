import { describe, expect, it } from 'vitest';
import presets from './_fixture/generated/contract.json' with { type: 'json' };
import attributes from './_fixture-attributes/generated/contract.json' with { type: 'json' };

describe('Mongo date fields written with @onCreate(now()) and @onUpdate(now())', () => {
  it('emit the same storage and execution hashes as the temporal presets they replace', () => {
    expect({
      storageHash: attributes.storage.storageHash,
      executionHash: attributes.execution?.executionHash,
    }).toEqual({
      storageHash: presets.storage.storageHash,
      executionHash: presets.execution?.executionHash,
    });
  });
});
