#!/bin/bash

set -ex

git clone https://github.com/timsuchanek/last-git-changes.git
cd last-git-changes

node -v
npm install
npm run build

cd ..
node last-git-changes/bin.js --exclude='docs,examples,scripts,README.md,LICENSE,CONTRIBUTING.md,.github,.prettierrc.yml' 
export CHANGED_COUNT=$(node last-git-changes/bin.js --exclude='docs,examples,scripts,README.md,LICENSE,CONTRIBUTING.md,.github,.prettierrc.yml' | wc -l)

echo $BUILDKITE_TAG
echo $CHANGED_COUNT

if [ $CHANGED_COUNT -gt 0 ]; then
  buildkite-agent pipeline upload src/.buildkite/test/test.yml
else
  echo "Nothing changed"
fi

