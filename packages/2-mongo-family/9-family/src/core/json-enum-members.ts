import type { JsonValue } from '@internal/contract/types';
import {
  type AuthoringEntityContext,
  duplicateStoredMembers,
  type EnumBlockMember,
  enumMemberProblemDiagnostic,
  type ParsedPslExtensionBlock,
} from '@internal/framework-components/authoring';
import { type Codec, readContractValue } from '@internal/framework-components/codec';
import { isInternalError } from '@internal/utils/internal-error';

/**
 * Reads the members of a MongoDB `enum` block as JSON: the codec's data type reads each member's JSON value, or a bare member's name, and the codec converts it. Pushes a diagnostic and returns `undefined` when a member is refused, when two members store the same value, or when the block has no members.
 */
export function readJsonEnumMembers(
  block: ParsedPslExtensionBlock<Readonly<Record<string, JsonValue | undefined>>>,
  codecId: string,
  codec: Codec,
  ctx: AuthoringEntityContext,
): readonly EnumBlockMember[] | undefined {
  const sourceId = ctx.sourceId ?? 'unknown';
  const diagnostics = ctx.diagnostics;
  const members: EnumBlockMember[] = [];
  const storedMembers: { readonly name: string; readonly stored: JsonValue }[] = [];
  let memberError = false;

  for (const [memberName, memberValue] of Object.entries(block.values)) {
    const span = block.parameterSpans[memberName] ?? block.span;
    let read: unknown;
    try {
      read = readContractValue(
        codec,
        memberValue === undefined ? memberName : memberValue,
        undefined,
      );
    } catch (error) {
      if (isInternalError(error)) throw error;
      diagnostics?.push(
        memberValue === undefined
          ? {
              code: 'PSL_ENUM_BARE_MEMBER_NON_STRING_CODEC',
              message: `enum "${block.name}" member "${memberName}" has no value and codec "${codecId}" does not accept a bare name as input`,
              sourceId,
              span,
            }
          : {
              code: 'PSL_EXTENSION_INVALID_VALUE',
              message: `enum "${block.name}" member "${memberName}" was rejected by codec "${codecId}": ${error instanceof Error ? error.message : String(error)}`,
              sourceId,
              span,
            },
      );
      memberError = true;
      continue;
    }
    members.push({ name: memberName, value: read });
    storedMembers.push({
      name: memberName,
      stored: codec.dataType.toContract(codec.toDataTypeValue(read)),
    });
  }

  for (const duplicate of duplicateStoredMembers(storedMembers, codec.dataType.equalityKey)) {
    diagnostics?.push(
      enumMemberProblemDiagnostic(
        { kind: 'duplicate-member-value', ...duplicate },
        {
          enumName: block.name,
          codecId,
          sourceId,
          span: block.span,
          memberSpans: block.parameterSpans,
        },
      ),
    );
    memberError = true;
  }
  if (memberError) return undefined;

  if (members.length === 0) {
    diagnostics?.push({
      code: 'PSL_ENUM_MISSING_TYPE',
      message: `enum "${block.name}" must have at least one member`,
      sourceId,
      span: block.span,
    });
    return undefined;
  }
  return members;
}
