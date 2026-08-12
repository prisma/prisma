/**
 * Test-only fixture extension: a DECLARATIVE `policy_select` block descriptor.
 *
 * This extension contributes NO parser or printer code. The framework owns
 * the generic parser, validator, and printer. The extension supplies only:
 *
 *  - A declarative `AuthoringPslBlockDescriptor` with keyword, discriminator,
 *    name.required, and a `parameters` map.
 *  - A matching `entityTypes` factory that reads the uniform `PslExtensionBlock`
 *    node (name + parameters map) and returns a `PolicySelectIr` instance.
 *
 * Block shape exercised:
 *
 * ```
 * policy_select <name> {
 *   target = <ModelRef>
 *   as     = permissive | restrictive        (optional)
 *   roles  = [<RoleRef>, …]                  (optional, cross-space)
 *   using  = "<predicate>"
 * }
 * ```
 *
 * The `using` parameter is a `value` kind keyed to the stub codec
 * `fixture-policy/text@1`, which accepts any double-quoted string.
 * The round-trip test (`../declarative-policy-select.round-trip.test.ts`)
 * registers that stub codec and exercises parse → validate → lower → IR.
 */

import type {
  AuthoringContributions,
  AuthoringEntityContext,
  PslExtensionBlock,
  PslExtensionBlockParamRef,
  PslExtensionBlockParamScalarValue,
} from '@internal/framework-components/authoring';
import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

export const POLICY_SELECT_KEYWORD = 'policy_select';
export const POLICY_SELECT_DISCRIMINATOR = 'fixture-policy-select';

/** Codec ID used by the `using` value parameter in this fixture. */
export const FIXTURE_POLICY_CODEC_ID = 'fixture-policy/text@1';

export interface PolicySelectIrInput {
  readonly name: string;
  /** Resolved model name (raw identifier from the `target` ref parameter). */
  readonly target: string;
  /** Chosen option token, or undefined when the `as` parameter was omitted. */
  readonly as?: 'permissive' | 'restrictive' | undefined;
  /** Raw predicate string extracted from the `using` value literal. */
  readonly using: string;
}

/**
 * IR class for the fixture's `policy_select` block. Plain readonly fields
 * only — JSON-clean by construction. Frozen on construction via `freezeNode`.
 * Hydrate from JSON via {@link hydratePolicySelectIrFromJson}.
 */
export class PolicySelectIr extends IRNodeBase {
  override readonly kind: typeof POLICY_SELECT_DISCRIMINATOR = POLICY_SELECT_DISCRIMINATOR;
  readonly name: string;
  readonly target: string;
  readonly as?: 'permissive' | 'restrictive';
  readonly using: string;

  constructor(input: PolicySelectIrInput) {
    super();
    this.name = input.name;
    this.target = input.target;
    if (input.as !== undefined) {
      this.as = input.as;
    }
    this.using = input.using;
    freezeNode(this);
  }
}

export function hydratePolicySelectIrFromJson(value: unknown): PolicySelectIr {
  if (typeof value !== 'object' || value === null) {
    throw new Error('hydratePolicySelectIrFromJson: expected an object');
  }
  const record = value as Record<string, unknown>;
  if (record['kind'] !== POLICY_SELECT_DISCRIMINATOR) {
    throw new Error(
      `hydratePolicySelectIrFromJson: expected kind "${POLICY_SELECT_DISCRIMINATOR}", got "${String(record['kind'])}"`,
    );
  }
  const name = record['name'];
  const target = record['target'];
  const as = record['as'];
  const using = record['using'];
  if (typeof name !== 'string' || typeof target !== 'string' || typeof using !== 'string') {
    throw new Error('hydratePolicySelectIrFromJson: missing or mistyped name/target/using field');
  }
  if (as !== undefined && as !== 'permissive' && as !== 'restrictive') {
    throw new Error(`hydratePolicySelectIrFromJson: unexpected as value "${String(as)}"`);
  }
  return new PolicySelectIr({
    name,
    target,
    as: as as 'permissive' | 'restrictive' | undefined,
    using,
  });
}

/**
 * Reads a raw parameter value from the uniform `PslExtensionBlock` node as a
 * ref identifier. Returns `undefined` when the parameter is absent or is not
 * a `ref`-kind value.
 */
function readRefParam(block: PslExtensionBlock, key: string): string | undefined {
  const param = block.parameters[key];
  if (param === undefined) return undefined;
  return (param as PslExtensionBlockParamRef).kind === 'ref'
    ? (param as PslExtensionBlockParamRef).identifier
    : undefined;
}

/**
 * Reads a raw parameter value from the uniform `PslExtensionBlock` node as a
 * scalar value's `raw` string. Returns `undefined` when the parameter is
 * absent or is not a `value`-kind value.
 */
function readValueParam(block: PslExtensionBlock, key: string): string | undefined {
  const param = block.parameters[key];
  if (param === undefined) return undefined;
  return (param as PslExtensionBlockParamScalarValue).kind === 'value'
    ? (param as PslExtensionBlockParamScalarValue).raw
    : undefined;
}

/**
 * Reads the `as` option token from the uniform block node.
 */
function readAsParam(block: PslExtensionBlock): 'permissive' | 'restrictive' | undefined {
  const param = block.parameters['as'];
  if (param === undefined) return undefined;
  if (param.kind !== 'option') return undefined;
  const token = param.token;
  if (token === 'permissive' || token === 'restrictive') return token;
  return undefined;
}

/**
 * Strips enclosing double-quotes from a raw PSL string literal, e.g.
 * `"auth.uid() = user_id"` → `auth.uid() = user_id`. The validator has
 * already confirmed the literal is well-formed (double-quoted) by the time
 * the factory runs; this is a pure extraction step.
 */
function unwrapQuotedString(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return raw.slice(1, -1);
  }
  return raw;
}

export const declarativePolicySelectContributions = {
  entityTypes: {
    policy_select: {
      kind: 'entity',
      discriminator: POLICY_SELECT_DISCRIMINATOR,
      output: {
        factory: (block: PslExtensionBlock, _ctx: AuthoringEntityContext): PolicySelectIr => {
          const target = readRefParam(block, 'target') ?? '';
          const using = unwrapQuotedString(readValueParam(block, 'using') ?? '');
          const as = readAsParam(block);
          return new PolicySelectIr({ name: block.name, target, as, using });
        },
      },
    },
  },
  pslBlockDescriptors: {
    policy_select: {
      kind: 'pslBlock',
      keyword: POLICY_SELECT_KEYWORD,
      discriminator: POLICY_SELECT_DISCRIMINATOR,
      name: { required: true },
      parameters: {
        target: { kind: 'ref', refKind: 'model', scope: 'same-namespace', required: true },
        as: { kind: 'option', values: ['permissive', 'restrictive'] },
        roles: {
          kind: 'list',
          of: { kind: 'ref', refKind: 'role', scope: 'cross-space' },
        },
        using: { kind: 'value', codecId: FIXTURE_POLICY_CODEC_ID, required: true },
      },
    },
  },
} as const satisfies AuthoringContributions;
