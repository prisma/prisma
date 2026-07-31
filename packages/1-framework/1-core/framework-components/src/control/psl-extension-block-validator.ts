/**
 * Generic validator for extension-contributed top-level PSL blocks.
 *
 * One function — {@link validateExtensionBlock} — takes a parsed
 * {@link PslExtensionBlock}, its {@link AuthoringPslBlockDescriptor}, a
 * {@link CodecLookup} (for `value` parameters), and the set of
 * {@link PslNamespace} objects from the document (for `ref` resolution), and
 * returns the full list of {@link PslDiagnostic} objects for the block.
 *
 * Detection logic per failure mode:
 *
 * 1. **Unknown parameter** — keys present in `node.parameters` that are absent
 *    from `descriptor.parameters` (key-set difference). The parser stores
 *    unknown parameters as `kind:'value'` stubs; the validator discovers them
 *    by comparing the key sets, not by inspecting the captured kind.
 *
 * 2. **Missing required parameter** — `descriptor.parameters` entries with
 *    `required: true` whose key is absent from `node.parameters`.
 *
 * 3. **`option` value outside its set** — the captured `token` is not in
 *    `descriptor.values`.
 *
 * 4. **`value` rejected by its codec** — the raw string is first parsed as
 *    JSON (`JSON.parse(raw)`). If `JSON.parse` throws, the literal is not valid
 *    JSON and a `PSL_EXTENSION_INVALID_VALUE` diagnostic is emitted. If parsing
 *    succeeds but `codec.decodeJson(jsonValue)` throws, the JSON value is not
 *    acceptable to the codec and a `PSL_EXTENSION_INVALID_VALUE` diagnostic is
 *    emitted. If `codecLookup.get(codecId)` returns `undefined` (unknown codec
 *    id), a `PSL_EXTENSION_INVALID_VALUE` diagnostic is also emitted.
 *
 * 5. **`ref` that does not resolve within its scope** — the captured
 *    `identifier` is looked up in the PSL document's `PslNamespace` objects
 *    according to `param.scope`:
 *    - `same-namespace`: the referent must be in the same namespace as the
 *      block (the namespace containing the block).
 *    - `same-space`: the referent may be in any namespace in the document.
 *    - `cross-space`: pass-through — enforcement is scoped to first-consumer
 *      need (RLS roles). This case is documented and clearly flagged; the
 *      caller is responsible for wiring cross-space resolution when needed.
 *
 * 6. **`list`** — each element is validated against `param.of` recursively.
 *
 * ### `char`/`varchar` length
 * Not enforced. RLS `using`/`check` strings are unbounded text and the codec
 * already rejects structurally invalid literals; length constraints are a
 * database-side concern, not a PSL authoring constraint.
 *
 * ### `cross-space` scope
 * Implemented as a documented pass-through. The spec permits scoping
 * cross-space enforcement to first-consumer need (RLS roles). When RLS roles
 * arrive, wire `cross-space` resolution through the cross-contract-space
 * coordinate model `(spaceId, namespaceId, entityKind, entityName)`.
 */

import type { JsonValue } from '@internal/contract/types';
import { blindCast } from '@internal/utils/casts';
import type { CodecLookup } from '../shared/codec-types';
import type { AuthoringPslBlockDescriptor } from '../shared/framework-authoring';
import type {
  PslBlockParam,
  PslBlockParamRef,
  PslExtensionBlock,
  PslExtensionBlockParamValue,
  PslSpan,
} from '../shared/psl-extension-block';
import type { PslDiagnostic, PslNamespace } from './psl-ast';

/**
 * Context for ref resolution during extension-block validation.
 *
 * - `ownerNamespace` is the `PslNamespace` that contains the block being
 *   validated. Used for `same-namespace` scope checks.
 * - `allNamespaces` is every namespace in the document. Used for `same-space`
 *   scope checks.
 */
export interface ExtensionBlockRefResolutionContext {
  readonly ownerNamespace: PslNamespace;
  readonly allNamespaces: readonly PslNamespace[];
}

/**
 * Validate a single parsed extension block against its descriptor.
 *
 * Returns an array of {@link PslDiagnostic} objects (possibly empty). The
 * caller is responsible for threading `sourceId` into each returned diagnostic
 * — the returned objects already have `sourceId` set from the `sourceId`
 * parameter.
 *
 * @param node - The parsed block node produced by the generic framework parser.
 * @param descriptor - The descriptor that claims this block's keyword.
 * @param sourceId - The PSL source file identifier (threaded into diagnostics).
 * @param codecLookup - Used to validate `value`-kind parameter literals via
 *   `codecLookup.get(codecId)?.decodeJson(JSON.parse(raw))`.
 * @param refCtx - Namespace context for `ref`-kind scope resolution. Required
 *   when any descriptor parameter is `kind: 'ref'`; may be omitted if none are.
 */
export function validateExtensionBlock(
  node: PslExtensionBlock,
  descriptor: AuthoringPslBlockDescriptor,
  sourceId: string,
  codecLookup: CodecLookup,
  refCtx?: ExtensionBlockRefResolutionContext,
): readonly PslDiagnostic[] {
  const diagnostics: PslDiagnostic[] = [];

  const descriptorKeys = new Set(Object.keys(descriptor.parameters));
  const nodeKeys = new Set(Object.keys(node.parameters));

  // 1. Unknown parameters — keys in the node not in the descriptor.
  if (!descriptor.variadicParameters) {
    for (const key of nodeKeys) {
      if (!descriptorKeys.has(key)) {
        const captured = node.parameters[key];
        diagnostics.push({
          code: 'PSL_EXTENSION_UNKNOWN_PARAMETER',
          message: `Unknown parameter "${key}" in "${descriptor.keyword}" block "${node.name}". The descriptor does not declare this parameter.`,
          sourceId,
          span: captured?.span ?? node.span,
        });
      }
    }
  }

  // 2. Missing required parameters — required descriptor keys absent from the node.
  for (const [key, param] of Object.entries(descriptor.parameters)) {
    if (param.required === true && !nodeKeys.has(key)) {
      diagnostics.push({
        code: 'PSL_EXTENSION_MISSING_REQUIRED_PARAMETER',
        message: `Required parameter "${key}" is missing from "${descriptor.keyword}" block "${node.name}".`,
        sourceId,
        span: node.span,
      });
    }
  }

  // 3–5. Per-parameter validation for parameters that are present.
  for (const [key, param] of Object.entries(descriptor.parameters)) {
    const captured = node.parameters[key];
    if (captured === undefined) {
      continue;
    }
    validateParam(
      node,
      descriptor,
      key,
      param,
      captured,
      sourceId,
      codecLookup,
      refCtx,
      diagnostics,
    );
  }

  return diagnostics;
}

function validateParam(
  node: PslExtensionBlock,
  descriptor: AuthoringPslBlockDescriptor,
  key: string,
  param: PslBlockParam,
  captured: PslExtensionBlockParamValue,
  sourceId: string,
  codecLookup: CodecLookup,
  refCtx: ExtensionBlockRefResolutionContext | undefined,
  diagnostics: PslDiagnostic[],
): void {
  switch (param.kind) {
    case 'option': {
      if (captured.kind !== 'option') {
        return;
      }
      if (!param.values.includes(captured.token)) {
        diagnostics.push({
          code: 'PSL_EXTENSION_OPTION_OUT_OF_SET',
          message: `Parameter "${key}" in "${descriptor.keyword}" block "${node.name}" has value "${captured.token}" which is not one of the allowed values: ${param.values.map((v) => `"${v}"`).join(', ')}.`,
          sourceId,
          span: captured.span,
        });
      }
      return;
    }

    case 'value': {
      if (captured.kind !== 'value') {
        return;
      }
      const codec = codecLookup.get(param.codecId);
      if (codec === undefined) {
        diagnostics.push({
          code: 'PSL_EXTENSION_INVALID_VALUE',
          message: `Parameter "${key}" in "${descriptor.keyword}" block "${node.name}" references unknown codec "${param.codecId}".`,
          sourceId,
          span: captured.span,
        });
        return;
      }
      let jsonValue: unknown;
      try {
        jsonValue = JSON.parse(captured.raw);
      } catch {
        diagnostics.push({
          code: 'PSL_EXTENSION_INVALID_VALUE',
          message: `Parameter "${key}" in "${descriptor.keyword}" block "${node.name}" is not a valid JSON literal (expected a JSON string, number, boolean, or null): ${captured.raw}`,
          sourceId,
          span: captured.span,
        });
        return;
      }
      try {
        codec.decodeJson(
          blindCast<JsonValue, 'JSON.parse returns a JsonValue-compatible value'>(jsonValue),
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        diagnostics.push({
          code: 'PSL_EXTENSION_INVALID_VALUE',
          message: `Parameter "${key}" in "${descriptor.keyword}" block "${node.name}" was rejected by codec "${param.codecId}": ${reason}`,
          sourceId,
          span: captured.span,
        });
      }
      return;
    }

    case 'ref': {
      if (captured.kind !== 'ref') {
        return;
      }
      validateRef(
        node,
        descriptor,
        key,
        param,
        captured.identifier,
        captured.span,
        sourceId,
        refCtx,
        diagnostics,
      );
      return;
    }

    case 'list': {
      if (captured.kind !== 'list') {
        return;
      }
      for (const item of captured.items) {
        validateParam(
          node,
          descriptor,
          key,
          param.of,
          item,
          sourceId,
          codecLookup,
          refCtx,
          diagnostics,
        );
      }
      return;
    }
  }
}

function validateRef(
  node: PslExtensionBlock,
  descriptor: AuthoringPslBlockDescriptor,
  key: string,
  param: PslBlockParamRef,
  identifier: string,
  span: PslSpan,
  sourceId: string,
  refCtx: ExtensionBlockRefResolutionContext | undefined,
  diagnostics: PslDiagnostic[],
): void {
  if (param.scope === 'cross-space') {
    // cross-space enforcement is a documented pass-through. The spec permits
    // scoping cross-space resolution to first-consumer need (RLS roles). When
    // that consumer arrives, wire resolution here through the
    // cross-contract-space coordinate model
    // (spaceId, namespaceId, entityKind, entityName).
    // For now, cross-space refs pass validation unconditionally.
    return;
  }

  if (refCtx === undefined) {
    // If no resolution context was provided, skip ref resolution. This matches
    // the closed-grammar invariant: callers that register ref parameters must
    // provide resolution context; callers without namespaces (e.g. unit tests
    // that only exercise other validation modes) can omit it.
    return;
  }

  const namespacesToSearch: readonly PslNamespace[] =
    param.scope === 'same-namespace' ? [refCtx.ownerNamespace] : refCtx.allNamespaces;

  if (!resolveEntityInNamespaces(identifier, param.refKind, namespacesToSearch)) {
    const scopeLabel =
      param.scope === 'same-namespace' ? 'the same namespace' : 'any namespace in the schema';
    diagnostics.push({
      code: 'PSL_EXTENSION_UNRESOLVED_REF',
      message: `Parameter "${key}" in "${descriptor.keyword}" block "${node.name}" refers to "${identifier}" (expected ${param.refKind}), but no entity with that name and kind was found in ${scopeLabel}.`,
      sourceId,
      span,
    });
  }
}

/**
 * True if an entity named `name` of kind `refKind` exists in any of the given
 * namespaces. Built-in and extension kinds resolve the same way, through
 * `entries[refKind]`.
 */
function resolveEntityInNamespaces(
  name: string,
  refKind: string,
  namespaces: readonly PslNamespace[],
): boolean {
  for (const ns of namespaces) {
    const kindMap = ns.entries[refKind];
    if (kindMap !== undefined && Object.hasOwn(kindMap, name)) return true;
  }
  return false;
}
