const CARRIAGE_RETURN = 13;
const LINE_FEED = 10;

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export class SourceFile {
  readonly #text: string;
  readonly #lineStarts: readonly number[];

  constructor(text: string) {
    this.#text = text;
    const lineStarts: number[] = [0];
    for (let offset = 0; offset < text.length; offset++) {
      if (text.charCodeAt(offset) === LINE_FEED) {
        lineStarts.push(offset + 1);
      }
    }
    this.#lineStarts = lineStarts;
  }

  get text(): string {
    return this.#text;
  }

  get length(): number {
    return this.#text.length;
  }

  get lineCount(): number {
    return this.#lineStarts.length;
  }

  lineStartOffsets(): readonly number[] {
    return this.#lineStarts;
  }

  lineStartOffset(line: number): number {
    if (line <= 0) {
      return 0;
    }
    return this.#lineStarts[line] ?? this.#text.length;
  }

  lineEndOffset(line: number): number {
    if (line < 0) {
      return 0;
    }

    const nextLineStart = this.#lineStarts[line + 1];
    if (nextLineStart === undefined) {
      return this.#text.length;
    }

    const lineFeedOffset = nextLineStart - 1;
    const carriageReturnOffset = lineFeedOffset - 1;
    return this.#text.charCodeAt(carriageReturnOffset) === CARRIAGE_RETURN
      ? carriageReturnOffset
      : lineFeedOffset;
  }

  positionAt(offset: number): Position {
    const clamped = clamp(offset, 0, this.#text.length);
    const line = this.#lineIndexAt(clamped);
    return { line, character: clamped - this.#lineStartAt(line) };
  }

  offsetAt(position: Position): number {
    const line = clamp(position.line, 0, this.#lineStarts.length - 1);
    const lineStart = this.#lineStartAt(line);
    const lineEnd = this.#lineEndAt(line);
    return clamp(lineStart + position.character, lineStart, lineEnd);
  }

  #lineStartAt(line: number): number {
    return this.#lineStarts[line] ?? 0;
  }

  #lineEndAt(line: number): number {
    return line + 1 < this.#lineStarts.length ? this.#lineStartAt(line + 1) - 1 : this.#text.length;
  }

  #lineIndexAt(offset: number): number {
    const lineStarts = this.#lineStarts;
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >>> 1;
      if ((lineStarts[mid] ?? 0) <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
