# accelerate-contract

⚠️ **Warning**: This package is intended for Prisma's internal use. Its release
cycle does not follow SemVer, which means we might release breaking changes
(change APIs, remove functionality) without any prior warning.

## Purpose

Accelerate has ownership of the `AccelerateEngine`. This
engine is handed over to the Client by the Accelerate extension. The Client uses
the engine to communicate with the Accelerate service. Accelerate uses the
Client to formulate and execute queries. This means we need some kind of
contract between the Client and the Accelerate service.

If the Client breaks this contract, that translates into a breaking change for
Accelerate users. This is why we need to be very careful when changing the
`AccelerateEngine` and the `AccelerateEngineConfig`.

## How it works

Both `@prisma/client` and `@prisma/extension-accelerate` will both pin this
package to an agreed same specific version (eg. 5.10.0-dev.45). In turn this
will prevent `@prisma/extension-accelerate` from deviating from the API provided
by `@prisma/client`, and it will prevent `@prisma/client` from introducing
backwards incompatible changes to the internal `AccelerateEngineConfig`.

This is one safe-guard to catch breaking changes statically via TypeScript.
That's in addition to running all our functional tests as usual.

## What it contains

This package contains the `AccelerateEngineConfig` and `AccelerateEngine` types.
They are the contract that the Client and the Accelerate extension agree upon.
