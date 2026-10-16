/** What a check description says the operation expects: the named object `absent` from the database, or `present` in it. */
export interface CheckDescriptionReading {
  readonly expects: 'absent' | 'present';
  readonly object: string;
}

const ABSENT = /^(?:ensure )?(.+?) (?:does not (?:already )?exist|is missing)( on .+)?$/;
const ABSENT_FROM = /^(?:ensure )?(.+?) is absent from (.+)$/;
const PRESENT = /^(?:ensure )?(.+?) exists( on .+)?$/;

/**
 * Reads a check description, as a target writes it into an operation's precheck or postcheck, for whether it expects an object absent or present: `ensure index "x" does not exist`, `ensure column "y" does not exist on "item"`, `collection users does not exist`, `ensure column "x" is missing` and `ensure value "b" is absent from enum type "Mood"` expect it absent; `ensure table "x" exists` and `index exists on users` present. Any other description, `undefined`.
 */
export function readCheckDescription(description: string): CheckDescriptionReading | undefined {
  const absent = ABSENT.exec(description);
  if (absent?.[1] !== undefined) {
    return { expects: 'absent', object: `${absent[1]}${absent[2] ?? ''}` };
  }
  const absentFrom = ABSENT_FROM.exec(description);
  if (absentFrom?.[1] !== undefined && absentFrom[2] !== undefined) {
    return { expects: 'absent', object: `${absentFrom[1]} in ${absentFrom[2]}` };
  }
  const present = PRESENT.exec(description);
  if (present?.[1] !== undefined) {
    return { expects: 'present', object: `${present[1]}${present[2] ?? ''}` };
  }
  return undefined;
}
