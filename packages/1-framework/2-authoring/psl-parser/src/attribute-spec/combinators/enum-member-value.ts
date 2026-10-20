import { bool } from './bool';
import { mapArg } from './map-arg';
import { num } from './num';
import { oneOf } from './one-of';
import { str } from './str';
import { taggedLiteral } from './tagged-literal';

/**
 * An enum member's written value: a string, a number, a boolean or a tagged literal. The value a
 * block records here only says which syntax was written, for inferring an enum's codec; the
 * member's value is read from `writtenValues` by the cast rule, so a tagged literal records `null`.
 * ADR 254.
 */
export function enumMemberValue() {
  return oneOf(
    str(),
    num(),
    bool(),
    mapArg(
      taggedLiteral([], { documentation: "A value written with its data type's tag." }),
      () => null,
    ),
  );
}
