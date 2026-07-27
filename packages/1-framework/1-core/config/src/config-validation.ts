import { configError } from './config-errors';
import type { PrismaNextConfig } from './config-types';

function throwValidation(field: string, why?: string): never {
  const message = why ?? `Config must have a "${field}" field`;
  throw configError('CONFIG.VALIDATION_FAILED', message, { why: message, meta: { field } });
}

function validateContractConfig(contract: Record<string, unknown>): void {
  if (!Object.hasOwn(contract, 'source')) {
    throwValidation(
      'contract.source',
      'Config.contract.source is required when contract is provided',
    );
  }

  const source = contract['source'];
  if (!source || typeof source !== 'object') {
    throwValidation('contract.source', 'Config.contract.source must be a provider object');
  }

  const sourceConfig = source as Record<string, unknown>;
  const inputs = Object.hasOwn(sourceConfig, 'inputs') ? sourceConfig['inputs'] : undefined;

  if (inputs !== undefined) {
    if (!Array.isArray(inputs)) {
      throwValidation(
        'contract.source.inputs',
        'Config.contract.source.inputs must be an array of strings when provided',
      );
    }

    for (const input of inputs) {
      if (typeof input !== 'string') {
        throwValidation(
          'contract.source.inputs[]',
          'Config.contract.source.inputs must contain only strings',
        );
      }
    }
  }

  if (!Object.hasOwn(sourceConfig, 'load') || typeof sourceConfig['load'] !== 'function') {
    throwValidation('contract.source.load', 'Config.contract.source.load must be a function');
  }

  const output = Object.hasOwn(contract, 'output') ? contract['output'] : undefined;
  if (output !== undefined && typeof output !== 'string') {
    throwValidation('contract.output', 'Config.contract.output must be a string when provided');
  }
}

/**
 * Validates that the config has the required structure.
 * This is pure validation logic with no file I/O or CLI awareness.
 *
 * @param config - Config object to validate
 * @throws a `CONFIG.VALIDATION_FAILED` structured error if config structure is invalid
 */
export function validateConfig(config: unknown): asserts config is PrismaNextConfig {
  if (!config || typeof config !== 'object') {
    throwValidation('object', 'Config must be an object');
  }

  const configObj = config as Record<string, unknown>;

  if (!configObj['family']) {
    throwValidation('family');
  }

  if (!configObj['target']) {
    throwValidation('target');
  }

  if (!configObj['adapter']) {
    throwValidation('adapter');
  }

  // Validate family descriptor
  const family = configObj['family'] as Record<string, unknown>;
  if (family['kind'] !== 'family') {
    throwValidation('family.kind', 'Config.family must have kind: "family"');
  }
  if (typeof family['id'] !== 'string') {
    throwValidation('family.id', 'Config.family must have id: string');
  }
  if (typeof family['familyId'] !== 'string') {
    throwValidation('family.familyId', 'Config.family must have familyId: string');
  }
  if (typeof family['version'] !== 'string') {
    throwValidation('family.version', 'Config.family must have version: string');
  }
  if (!family['emission'] || typeof family['emission'] !== 'object') {
    throwValidation('family.emission', 'Config.family must have emission: EmissionSpi');
  }
  if (typeof family['create'] !== 'function') {
    throwValidation('family.create', 'Config.family must have create: function');
  }

  const familyId = family['familyId'] as string;

  // Validate target descriptor
  const target = configObj['target'] as Record<string, unknown>;
  if (target['kind'] !== 'target') {
    throwValidation('target.kind', 'Config.target must have kind: "target"');
  }
  if (typeof target['id'] !== 'string') {
    throwValidation('target.id', 'Config.target must have id: string');
  }
  if (typeof target['familyId'] !== 'string') {
    throwValidation('target.familyId', 'Config.target must have familyId: string');
  }
  if (typeof target['version'] !== 'string') {
    throwValidation('target.version', 'Config.target must have version: string');
  }
  if (target['familyId'] !== familyId) {
    throwValidation(
      'target.familyId',
      `Config.target.familyId must match Config.family.familyId (expected: ${familyId}, got: ${target['familyId']})`,
    );
  }
  if (typeof target['targetId'] !== 'string') {
    throwValidation('target.targetId', 'Config.target must have targetId: string');
  }
  if (typeof target['create'] !== 'function') {
    throwValidation('target.create', 'Config.target must have create: function');
  }
  const expectedTargetId = target['targetId'] as string;

  // Validate adapter descriptor
  const adapter = configObj['adapter'] as Record<string, unknown>;
  if (adapter['kind'] !== 'adapter') {
    throwValidation('adapter.kind', 'Config.adapter must have kind: "adapter"');
  }
  if (typeof adapter['id'] !== 'string') {
    throwValidation('adapter.id', 'Config.adapter must have id: string');
  }
  if (typeof adapter['familyId'] !== 'string') {
    throwValidation('adapter.familyId', 'Config.adapter must have familyId: string');
  }
  if (typeof adapter['version'] !== 'string') {
    throwValidation('adapter.version', 'Config.adapter must have version: string');
  }
  if (adapter['familyId'] !== familyId) {
    throwValidation(
      'adapter.familyId',
      `Config.adapter.familyId must match Config.family.familyId (expected: ${familyId}, got: ${adapter['familyId']})`,
    );
  }
  if (typeof adapter['targetId'] !== 'string') {
    throwValidation('adapter.targetId', 'Config.adapter must have targetId: string');
  }
  if (adapter['targetId'] !== expectedTargetId) {
    throwValidation(
      'adapter.targetId',
      `Config.adapter.targetId must match Config.target.targetId (expected: ${expectedTargetId}, got: ${adapter['targetId']})`,
    );
  }
  if (typeof adapter['create'] !== 'function') {
    throwValidation('adapter.create', 'Config.adapter must have create: function');
  }

  if (configObj['extensionPacks'] !== undefined) {
    throwValidation(
      'extensionPacks',
      'Config.extensionPacks is no longer supported; rename it to Config.extensions',
    );
  }

  // Validate extensions array if present
  if (configObj['extensions'] !== undefined) {
    if (!Array.isArray(configObj['extensions'])) {
      throwValidation('extensions', 'Config.extensions must be an array');
    }
    for (const ext of configObj['extensions']) {
      if (!ext || typeof ext !== 'object') {
        throwValidation(
          'extensions[]',
          'Config.extensions must contain ControlExtensionDescriptor objects',
        );
      }
      const extObj = ext as Record<string, unknown>;
      if (extObj['kind'] !== 'extension') {
        throwValidation('extensions[].kind', 'Config.extensions items must have kind: "extension"');
      }
      if (typeof extObj['id'] !== 'string') {
        throwValidation('extensions[].id', 'Config.extensions items must have id: string');
      }
      if (typeof extObj['familyId'] !== 'string') {
        throwValidation(
          'extensions[].familyId',
          'Config.extensions items must have familyId: string',
        );
      }
      if (typeof extObj['version'] !== 'string') {
        throwValidation(
          'extensions[].version',
          'Config.extensions items must have version: string',
        );
      }
      if (extObj['familyId'] !== familyId) {
        throwValidation(
          'extensions[].familyId',
          `Config.extensions[].familyId must match Config.family.familyId (expected: ${familyId}, got: ${extObj['familyId']})`,
        );
      }
      if (typeof extObj['targetId'] !== 'string') {
        throwValidation(
          'extensions[].targetId',
          'Config.extensions items must have targetId: string',
        );
      }
      if (extObj['targetId'] !== expectedTargetId) {
        throwValidation(
          'extensions[].targetId',
          `Config.extensions[].targetId must match Config.target.targetId (expected: ${expectedTargetId}, got: ${extObj['targetId']})`,
        );
      }
      if (typeof extObj['create'] !== 'function') {
        throwValidation(
          'extensions[].create',
          'Config.extensions items must have create: function',
        );
      }
    }
  }

  // Validate driver descriptor if present
  if (configObj['driver'] !== undefined) {
    const driver = configObj['driver'] as Record<string, unknown>;
    if (driver['kind'] !== 'driver') {
      throwValidation('driver.kind', 'Config.driver must have kind: "driver"');
    }
    if (typeof driver['id'] !== 'string') {
      throwValidation('driver.id', 'Config.driver must have id: string');
    }
    if (typeof driver['version'] !== 'string') {
      throwValidation('driver.version', 'Config.driver must have version: string');
    }
    if (typeof driver['familyId'] !== 'string') {
      throwValidation('driver.familyId', 'Config.driver must have familyId: string');
    }
    if (driver['familyId'] !== familyId) {
      throwValidation(
        'driver.familyId',
        `Config.driver.familyId must match Config.family.familyId (expected: ${familyId}, got: ${driver['familyId']})`,
      );
    }
    if (typeof driver['targetId'] !== 'string') {
      throwValidation('driver.targetId', 'Config.driver must have targetId: string');
    }
    if (driver['targetId'] !== expectedTargetId) {
      throwValidation(
        'driver.targetId',
        `Config.driver.targetId must match Config.target.targetId (expected: ${expectedTargetId}, got: ${driver['targetId']})`,
      );
    }
    if (typeof driver['create'] !== 'function') {
      throwValidation('driver.create', 'Config.driver must have create: function');
    }
  }

  // Validate contract config if present (structure validation - defineConfig() handles normalization)
  if (configObj['contract'] !== undefined) {
    const contract = configObj['contract'] as Record<string, unknown>;
    if (!contract || typeof contract !== 'object') {
      throwValidation('contract', 'Config.contract must be an object');
    }
    validateContractConfig(contract);
  }
}
