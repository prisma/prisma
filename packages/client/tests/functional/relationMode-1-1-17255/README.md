## Testing reproduction from https://github.com/prisma/prisma/issues/17255

How to run these tests?

```sh
RELATION_MODE= pnpm run test:functional:code --relation-mode-tests-only relationMode-1-1-17255
RELATION_MODE=prisma pnpm run test:functional:code --relation-mode-tests-only relationMode-1-1-17255
```
