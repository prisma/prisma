## Testing reproduction from https://github.com/prisma/prisma/issues/17255

This is the NOT the original reproduction, see ../relationMode-1-1-17255-mixed-actions

This is almost the same schema but using the same referential actions everywhere

How to run these tests?

```sh
RELATION_MODE= pnpm run test:functional:code --relation-mode-tests-only relationMode-1-1-17255
RELATION_MODE=prisma pnpm run test:functional:code --relation-mode-tests-only relationMode-1-1-17255
```
