#!/bin/bash

set -ex

git clone https://github.com/timsuchanek/last-git-changes.git
cd last-git-changes

node -v
npm install
npm run build

cd ..

# Any update here needs to be done for 
# - https://github.com/prisma/prisma/blob/master/.github/workflows/test.yml#L8 GitHub Actions
# - https://github.com/prisma/prisma/blob/master/src/.buildkite/test/buildkite-entry.sh
EXCLUDE_LIST="*.bench.ts,docs,.vscode,examples,src/graphs,README.md,LICENSE,CONTRIBUTING.md,.github"
echo $EXCLUDE_LIST
node last-git-changes/bin.js --exclude="$EXCLUDE_LIST"
export CHANGED_COUNT=$(node last-git-changes/bin.js --exclude="$EXCLUDE_LIST" | wc -l)

echo $BUILDKITE_TAG
echo $CHANGED_COUNT
echo $BUILDKITE_SOURCE
echo $UPDATE_STUDIO

if [ $CHANGED_COUNT -gt 0 ] || [ $BUILDKITE_TAG ] || [ $BUILDKITE_SOURCE == "trigger_job" ] || [ $UPDATE_STUDIO ]; then
  buildkite-agent pipeline upload src/.buildkite/publish/publish.yml
else
  echo "Nothing changed"
fi
