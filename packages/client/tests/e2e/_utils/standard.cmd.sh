#!/bin/bash

set -euo pipefail

# Get access to localhost
export DOCKER_BRIDGE_IP=$(ip route | grep default | awk '{print $3}') # 172.17.0.1

# Database env variables
export PRISMA_DB_NAME=$(cat /dev/urandom | tr -dc 'a-z0-9' | head -c 16)
export TEST_E2E_POSTGRES_URI="postgres://prisma:prisma@${DOCKER_BRIDGE_IP}:5432/${PRISMA_DB_NAME}"
export TEST_E2E_MYSQL_URI="mysql://root:root@${DOCKER_BRIDGE_IP}:3306/${PRISMA_DB_NAME}"
export TEST_E2E_VITESS_8_URI="mysql://root:root@${DOCKER_BRIDGE_IP}:33807/${PRISMA_DB_NAME}"
export TEST_E2E_MSSQL_URI="sqlserver://${DOCKER_BRIDGE_IP}:1433;database=${PRISMA_DB_NAME};user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;"
export TEST_E2E_MONGO_URI="mongodb://${DOCKER_BRIDGE_IP}:27018/${PRISMA_DB_NAME}"
export TEST_E2E_COCKROACH_URI="postgresql://prisma@${DOCKER_BRIDGE_IP}:26257/${PRISMA_DB_NAME}"

# Other env variables
export NODE_PATH=$(npm root --quiet -g) # make global packages available
export NEXT_TELEMETRY_DISABLED=1
export NO_COLOR=1
export PRISMA_SKIP_POSTINSTALL_GENERATE='true' # because we run generate already

# Script variables
BASE_DIR=$(echo "$NAME" | awk -F "/" '{print $1}')
PNPM_EXDEV_WARN_REGEX="WARN.*?EXDEV" # pnpm warns when it can't symlink
PNPM_FALLBACK_COPY_REGEX="Falling back to copying packages from store"
OUTPUT_REMOVAL_REGEX="$PNPM_EXDEV_WARN_REGEX|$PNPM_FALLBACK_COPY_REGEX"

rm -f /e2e/$NAME/LOGS.txt

# Script execution
(
  cd /e2e;
  mkdir -p /test/$NAME;
  cp -r _utils /test/_utils;
  # include _shared folders which are useful to share code in multi-folders
  find $BASE_DIR -type d -name '_shared' -exec cp -r --parents '{}' /test \;
  # copy the test files and their structure but exclude node_modules folder
  find $NAME -type d -name node_modules -prune -o -type f -name '*' -exec cp --parents '{}' /test \;
  # copy some necessary files that are needed for all the tests to run well
  cp tsconfig.base.json /test/tsconfig.base.json;
  cp jest.config.js /test/$NAME/jest.config.js;
  # execute the test by running the _steps.ts file with tsx
  cd /test/$NAME;
  tsx _steps.ts;
  # when inline snapshots are created the first time, copy for convencience
  cp -r /test/$NAME/tests/* /e2e/$NAME/tests/ 2> /dev/null || true;
  cp -r /test/$NAME/pnpm-lock.yaml /e2e/$NAME/ 2> /dev/null || true;
) 2>&1 | grep -v -E --line-buffered "$OUTPUT_REMOVAL_REGEX" > /e2e/$NAME/LOGS.txt;
