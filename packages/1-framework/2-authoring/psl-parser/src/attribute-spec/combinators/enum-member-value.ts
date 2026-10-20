import type { WrittenScalar } from '@internal/framework-components/authoring';
import { bool } from './bool';
import { mapArg } from './map-arg';
import { num } from './num';
import { oneOf } from './one-of';
import { str } from './str';
import { taggedLiteral } from './tagged-literal';

/**
 * An enum member's written value: a string, a number, a boolean, or a tagged literal, which it
 * yields as the written value, its tag and canonical text. A tagged literal whose text cannot be
 * canonicalized yields `null`, and the member reader refuses it. The block also records each
 * member as written in `writtenValues`, from which the member reader takes it by the cast rule.
 * ADR 254.
 */
export function enumMemberValue() {
  return oneOf(
    str(),
    num(),
    bool(),
    mapArg(
      taggedLiteral([], { documentation: "A value written with its data type's tag." }),
      ({ tag, canonicalization }): WrittenScalar | null =>
        canonicalization.ok ? { kind: 'tag', tag, text: canonicalization.text } : null,
    ),
  );
}
