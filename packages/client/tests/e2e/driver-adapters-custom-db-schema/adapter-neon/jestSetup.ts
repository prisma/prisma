const { webcrypto } = require('node:crypto')

// Note: the `crypto` shim provided below is not enough, but is preserved for reference purposes.
// We also needed to patch `@neondatabase/serverless` to use
//
// ```javascript
// export const crypto = globalThis.crypto ?? require('node:crypto').webcrypto;
// ```
//
// instead of
//
// ```javascript
// export const crypto = globalThis.crypto ?? {};
// ```
//
// The patch is applied via `pnpm patch @neondatabase/serverless`, and stored in `patches/@neondatabase__serverless*`.
// ----------------
//
// This `crypto` shim is needed to avoid `TypeError: g.getRandomValues is not a function` error in https://github.com/neondatabase/serverless/blob/14ac4a46b8c997fe8590e3bfa5dcc97eb5e9ca7e/shims/crypto/index.ts#L4.
// This must be set before importing `@neondatabase/serverless` due to https://github.com/neondatabase/serverless/blob/14ac4a46b8c997fe8590e3bfa5dcc97eb5e9ca7e/shims/shims.js#L7.
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto
}
