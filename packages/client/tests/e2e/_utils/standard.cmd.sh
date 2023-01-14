#!/bin/sh

(
  rm -fr /e2e/$NAME/.logs.* && \
  cp -r /e2e/_utils /_utils && \
  cp -r /e2e/$NAME /test && \
  cp /e2e/tsconfig.base.json tsconfig.base.json && \
  cp /e2e/prisma-0.0.0.tgz prisma-0.0.0.tgz && \
  cp /e2e/prisma-client-0.0.0.tgz prisma-client-0.0.0.tgz && \
  cp /e2e/jest.config.js /test/jest.config.js && \
  cd /test && rm -fr node_modules && \
  export NODE_PATH="$(npm root --quiet -g)" && \
  node -r 'esbuild-register' _steps.ts \
) > /$NAME.logs.txt 2>&1 ; \
EXIT_CODE=$? && \
mv /$NAME.logs.txt /e2e/$NAME/.logs.$EXIT_CODE.txt && \
exit $EXIT_CODE