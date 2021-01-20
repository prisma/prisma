#!/bin/bash

set -ex

git clone https://github.com/timsuchanek/last-git-changes.git
cd last-git-changes

node -v
npm install
npm run build

cd ..
EXCLUDE_LIST="'docs,.vscode,examples,src/scripts,src/graphs,README.md,LICENSE,CONTRIBUTING.md,.github'"
echo $EXCLUDE_LIST
node last-git-changes/bin.js --exclude="$EXCLUDE_LIST"
export CHANGED_COUNT=$(node last-git-changes/bin.js --exclude="$EXCLUDE_LIST" | wc -l)

echo $BUILDKITE_TAG
echo $CHANGED_COUNT

if [ $CHANGED_COUNT -gt 0 ]; then
  buildkite-agent pipeline upload src/.buildkite/test/test.yml
else
  echo "Nothing changed"
fi

