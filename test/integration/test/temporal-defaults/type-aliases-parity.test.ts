import { describe, expect, it } from 'vitest';
import presets from './_fixture/generated/contract.json' with { type: 'json' };
import aliases from './_fixture-aliases/generated/contract.json' with { type: 'json' };

describe('columns typed by the temporal type aliases', () => {
  it('emit the same storage and execution hashes as the temporal presets they replace', () => {
    expect({
      storageHash: aliases.storage.storageHash,
      executionHash: aliases.execution?.executionHash,
    }).toEqual({
      storageHash: presets.storage.storageHash,
      executionHash: presets.execution?.executionHash,
    });
  });
});
