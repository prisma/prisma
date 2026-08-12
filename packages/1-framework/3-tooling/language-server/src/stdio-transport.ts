import { Readable, Writable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

/** Text sink, as a CLI engine models a process output stream. */
export interface TextSink {
  write(text: string): void;
}

/**
 * The stdio a host hands a language server: bytes in, text out, and the host's
 * own shutdown signal.
 */
export interface LanguageServerStreams {
  readonly stdin: AsyncIterable<Uint8Array>;
  readonly stdout: TextSink;
  readonly signal?: AbortSignal;
}

/**
 * `objectMode: false` is what makes this a byte stream rather than a stream of
 * whatever objects the host yielded: it converts each chunk to a `Buffer`.
 * `vscode-jsonrpc` needs that — it slices header blocks with
 * `Buffer.from(chunk, 0, length)`, and on a plain `Uint8Array` those arguments
 * are ignored, so it reads the whole chunk as one header block and rejects the
 * message.
 */
export function byteInputStream(stdin: AsyncIterable<Uint8Array>): Readable {
  return Readable.from(stdin, { objectMode: false });
}

/**
 * LSP declares each message's `Content-Length` in bytes, so a UTF-8 sequence
 * split across two writes has to be held back until it is whole: decoding half
 * of one yields a replacement character, which is a different number of bytes
 * than the header promised.
 */
export function textOutputStream(stdout: TextSink): Writable {
  const decoder = new StringDecoder('utf8');
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      stdout.write(decoder.write(chunk));
      callback();
    },
    final(callback) {
      const pending = decoder.end();
      if (pending !== '') {
        stdout.write(pending);
      }
      callback();
    },
  });
}
