#!/bin/sh

export PRISMA_DB_NAME=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
export TEST_E2E_POSTGRES_URI="postgres://prisma:prisma@172.17.0.1:5432/${PRISMA_DB_NAME}"
export TEST_E2E_MYSQL_URI="mysql://root:root@172.17.0.1:3306/${PRISMA_DB_NAME}"
export TEST_E2E_VITESS_8_URI="mysql://root:root@172.17.0.1:33807/${PRISMA_DB_NAME}"
export TEST_E2E_MSSQL_URI="sqlserver://172.17.0.1:1433;database=${PRISMA_DB_NAME};user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
export TEST_E2E_MONGO_URI="mongodb://root:prisma@172.17.0.1:27018/${PRISMA_DB_NAME}?authSource=admin"
export TEST_E2E_COCKROACH_URI="postgresql://prisma@172.17.0.1:26257/${PRISMA_DB_NAME}"

(
  rm -Rfr /e2e/$NAME/LOGS.*.txt && \
  cp -r /e2e/_utils /_utils && \
  cp -r /e2e/$NAME /test && \
  cp /e2e/tsconfig.base.json tsconfig.base.json && \
  cp /e2e/prisma-0.0.0.tgz prisma-0.0.0.tgz && \
  cp /e2e/prisma-client-0.0.0.tgz prisma-client-0.0.0.tgz && \
  cp /e2e/jest.config.js /test/jest.config.js && \
  cd /test && rm -fr node_modules && \
  export NODE_PATH="$(npm root --quiet -g)" && \
  node -r 'esbuild-register' _steps.ts \
) > /e2e/$NAME/LOGS.txt 2>&1 ; \
EXIT_CODE=$? && \
cp /e2e/$NAME/LOGS.txt /e2e/$NAME/LOGS.$EXIT_CODE.txt && \  # copy logs and append exit code
cp -r /test/tests/* /e2e/$NAME/tests/ && \                    # copy jest files for snapshots
exit $EXIT_CODE