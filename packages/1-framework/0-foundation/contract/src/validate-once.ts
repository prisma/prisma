import { blindCast } from '@internal/utils/casts';

interface ValidatedContract {
  readonly validator: string;
  readonly contract: object;
}

const validatedContractsKey = Symbol.for('prisma.orm.validatedContracts');

function validatedContracts(): WeakMap<object, ValidatedContract> {
  const existing: unknown = Reflect.get(globalThis, validatedContractsKey);
  if (existing instanceof WeakMap) {
    return existing;
  }
  const created = new WeakMap<object, ValidatedContract>();
  Object.defineProperty(globalThis, validatedContractsKey, { value: created });
  return created;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Runs `validate` on `input` unless `validator` already validated `input`, or `input` is a result
 * of that validation. The record is kept on `globalThis` under a `Symbol.for` key, so separate
 * bundles of the same code in one program share it.
 */
export function validateContractOnce<TContract extends object>(
  input: unknown,
  validator: string,
  validate: (input: unknown) => TContract,
): TContract {
  const registry = validatedContracts();
  if (isObject(input)) {
    const recorded = registry.get(input);
    if (recorded?.validator === validator) {
      return blindCast<
        TContract,
        'the record for this validator holds the contract its validate function returned'
      >(recorded.contract);
    }
  }
  const contract = validate(input);
  const record: ValidatedContract = { validator, contract };
  registry.set(contract, record);
  if (isObject(input)) {
    registry.set(input, record);
  }
  return contract;
}
