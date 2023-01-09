#!/bin/sh

(
  rm -fr /ecosystem/$NAME/.logs.* && \
  cp -r /ecosystem/_utils /_utils && \
  cp -r /ecosystem/$NAME /test && \
  cp /ecosystem/prisma-0.0.0.tgz prisma-0.0.0.tgz && \
  cp /ecosystem/prisma-client-0.0.0.tgz prisma-client-0.0.0.tgz && \
  cp /ecosystem/jest.config.js /test/jest.config.js && \
  cd /test && rm -fr node_modules && \
  export NODE_PATH="$(npm root --quiet -g)" && \
  node -r 'esbuild-register' _steps.ts \
) > /$NAME.logs.txt 2>&1 ; \
EXIT_CODE=$? && \
mv /$NAME.logs.txt /ecosystem/$NAME/.logs.$EXIT_CODE.txt && \
exit $EXIT_CODE