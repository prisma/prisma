import { Readable, Writable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

/** Text sink, as a CLI engine models a process output stream. */
export interface TextSink {
  write(text: string): void;
}

/**
 * The stdio a host hands a language server: bytes in, text out, and the host's
 * own shutdown signal.
 *
 * The client owns `stdout` — only protocol frames may reach it — and anything
 * the server has to say for itself goes to `stderr`.
 *
 * Releasing the process's stdin once the run settles is the host's job. The
 * server reads `stdin` for the length of the run, and destroying the `Readable`
 * built from it does not release the descriptor underneath: a Node host has to
 * call `process.stdin.unref()`, or the process sits on a pipe nobody is reading
 * after the run has already settled its exit code.
 */
export interface LanguageServerStreams {
  readonly stdin: AsyncIterable<Uint8Array>;
  readonly stdout: TextSink;
  readonly stderr: TextSink;
  readonly signal?: AbortSignal;
  /**
   * Process id of the editor that spawned the server — the value
   * `vscode-languageclient` passes as `--clientProcessId`. When set, the run
   * polls it and settles as a departed client if the editor dies without
   * closing the conversation.
   */
  readonly clientProcessId?: number;
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
 * Bridges the byte stream `vscode-jsonrpc` writes to the text sink a host
 * hands over.
 *
 * LSP declares each message's `Content-Length` in bytes, so a UTF-8 sequence
 * that arrives split across two writes has to be held back until it is whole:
 * decoding half of one yields a replacement character, which is a different
 * number of bytes than the header promised. `StreamMessageWriter` writes each
 * body in one call and Node never splits a chunk given to `_write`, so the
 * decoder holds nothing back in practice — it is here because the contract
 * this satisfies is "bytes in, text out", and a writer that chunks its bodies
 * would otherwise corrupt every multi-byte message silently.
 *
 * Back-pressure is dropped: `TextSink.write` returns nothing to wait on, so
 * every write reports flushed the moment the sink has taken it. A client that
 * stops reading grows the host's own output queue instead of slowing the
 * server down, and the diagnostics for a large schema are not small. Fixing it
 * needs a sink that reports when it drained.
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
