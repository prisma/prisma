import { describe, expect, it } from 'vitest';
import { textOutputStream } from '../src/stdio-transport';

function collector(): { readonly written: string[]; readonly write: (text: string) => void } {
  const written: string[] = [];
  return { written, write: (text) => written.push(text) };
}

describe('textOutputStream', () => {
  it('passes ASCII writes through unchanged', async () => {
    const out = collector();
    const stream = textOutputStream(out);

    stream.write(Buffer.from('Content-Length: 2\r\n\r\n', 'ascii'));
    stream.write(Buffer.from('{}', 'utf8'));
    await new Promise<void>((resolve) => stream.end(resolve));

    expect(out.written.join('')).toBe('Content-Length: 2\r\n\r\n{}');
  });

  it('reassembles a multi-byte character split across two writes', async () => {
    const out = collector();
    const stream = textOutputStream(out);
    const bytes = Buffer.from('π≈3', 'utf8');

    stream.write(bytes.subarray(0, 1));
    stream.write(bytes.subarray(1));
    await new Promise<void>((resolve) => stream.end(resolve));

    expect(out.written.join('')).toBe('π≈3');
  });

  it('re-encodes to the same byte count it was handed', async () => {
    const out = collector();
    const stream = textOutputStream(out);
    const body = JSON.stringify({ message: 'naïve — 日本語 — 🎉' });
    const bytes = Buffer.from(body, 'utf8');

    for (let offset = 0; offset < bytes.length; offset += 3) {
      stream.write(bytes.subarray(offset, offset + 3));
    }
    await new Promise<void>((resolve) => stream.end(resolve));

    expect(Buffer.byteLength(out.written.join(''), 'utf8')).toBe(bytes.length);
  });
});
