#!/bin/bash

# Database Env Vars
export PRISMA_DB_NAME=$(cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
export TEST_E2E_POSTGRES_URI="postgres://prisma:prisma@172.17.0.1:5432/${PRISMA_DB_NAME}"
export TEST_E2E_MYSQL_URI="mysql://root:root@172.17.0.1:3306/${PRISMA_DB_NAME}"
export TEST_E2E_VITESS_8_URI="mysql://root:root@172.17.0.1:33807/${PRISMA_DB_NAME}"
export TEST_E2E_MSSQL_URI="sqlserver://172.17.0.1:1433;database=${PRISMA_DB_NAME};user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
export TEST_E2E_MONGO_URI="mongodb://root:prisma@172.17.0.1:27018/${PRISMA_DB_NAME}?authSource=admin"
export TEST_E2E_COCKROACH_URI="postgresql://prisma@172.17.0.1:26257/${PRISMA_DB_NAME}"

# Other Env Vars
export NEXT_TELEMETRY_DISABLED=1
export NO_COLOR=1

# Script variables
PNPM_EXDEV_WARN_REGEX="WARN.*?EXDEV"
PNPM_FALLBACK_COPY_REGEX="Falling back to copying packages from store"
OUTPUT_REMOVAL_REGEX="$PNPM_EXDEV_WARN_REGEX|$PNPM_FALLBACK_COPY_REGEX"

# Script setup and exec
(
  mkdir -p /test/$NAME && \
  cp -r /e2e/_utils /test/_utils && \
  cp -r /e2e/$NAME/* /test/$NAME && \
  cp /e2e/tsconfig.base.json /test/tsconfig.base.json && \
  cp /e2e/jest.config.js /test/$NAME/jest.config.js && \
  cp /e2e/prisma-0.0.0.tgz /test/prisma-0.0.0.tgz && \
  cp /e2e/prisma-client-0.0.0.tgz /test/prisma-client-0.0.0.tgz && \
  cd /test/$NAME && \
  find . -name "node_modules" -type d -prune -exec rm -rf '{}' + && \
  export NODE_PATH="$(npm root --quiet -g)" && \
  node -r 'esbuild-register' _steps.ts \
) 2>&1 | grep -v -E --line-buffered "$OUTPUT_REMOVAL_REGEX" > /e2e/$NAME/LOGS.txt; \
exit ${PIPESTATUS[0]}