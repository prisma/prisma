# Readme

Issue #19999: tsc crashes when using extensions and when that client is
exported. This caused OOM errors in the language server, and was especially
exacerbated by the use of $allModels in combination of generic type utils.

In turn this caused to issues depending on the severity:

- The compiler does not run out of memory, but cannot serialize the types.
  https://github.com/prisma/prisma/issues/16536
- The compiler runs out of memory and crashes the Node.js process.
  https://github.com/prisma/prisma/issues/19999
