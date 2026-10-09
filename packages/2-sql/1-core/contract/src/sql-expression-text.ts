/** Keywords that end an expression and continue the statement around it. */
const STATEMENT_KEYWORDS = new Set([
  'FROM',
  'WHERE',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'GROUP',
  'ORDER',
  'HAVING',
  'LIMIT',
  'RETURNING',
  'WINDOW',
]);

const CLOSING_QUOTE: Readonly<Record<string, string>> = {
  "'": "'",
  '"': '"',
  '`': '`',
  '[': ']',
};

const WORD = /[A-Za-z_][A-Za-z0-9_$]*/y;
const DOLLAR_QUOTE = /\$[A-Za-z_]*\$/y;

/**
 * Returns undefined when `text` is one SQL expression that a migration may write into a statement,
 * such as the conversion of an `ALTER COLUMN … USING` clause or a column of an `INSERT … SELECT`
 * list, else what makes it more than that. Quoted literals and quoted identifiers may hold
 * anything; outside them the text may not hold a semicolon, a SQL comment, dollar quoting, or, outside
 * parentheses, a keyword that would end the expression and reshape the statement around it.
 */
export function checkSqlExpressionText(text: string): string | undefined {
  let depth = 0;
  let index = 0;
  while (index < text.length) {
    const character = text[index] ?? '';
    const closing = CLOSING_QUOTE[character];
    if (closing !== undefined) {
      let end = text.indexOf(closing, index + 1);
      while (end !== -1 && closing !== ']' && text[end + 1] === closing) {
        end = text.indexOf(closing, end + 2);
      }
      if (end === -1) return 'a quote that is not closed';
      index = end + 1;
      continue;
    }
    if (character === ';') return 'a semicolon outside a quoted literal';
    if (text.startsWith('--', index) || text.startsWith('/*', index)) return 'a SQL comment';
    DOLLAR_QUOTE.lastIndex = index;
    if (character === '$' && DOLLAR_QUOTE.test(text)) return 'dollar quoting';
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth < 0) return 'parentheses that do not match';
    }
    WORD.lastIndex = index;
    const word = /[A-Za-z_]/.test(character) ? WORD.exec(text)?.[0] : undefined;
    if (word !== undefined) {
      if (depth === 0 && STATEMENT_KEYWORDS.has(word.toUpperCase())) {
        return `the keyword ${word.toUpperCase()} outside parentheses`;
      }
      index += word.length;
      continue;
    }
    index += 1;
  }
  return depth === 0 ? undefined : 'parentheses that do not match';
}
