set -ex

if [[ $BUILDKITE_COMMIT ]]; then
  export LAST_COMMIT=$BUILDKITE_COMMIT
else
  export LAST_COMMIT=$(git merge-base --fork-point HEAD)
fi

export CLI_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT cli | wc -l)

if [ $CLI_CHANGED_COUNT -gt 0 ]; then
  export CLI_CHANGED=true
fi

export PRISMA2_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT prisma2 | wc -l)
if [ $PRISMA2_CHANGED_COUNT -gt 0 ]; then
  export PRISMA2_CHANGED=true
fi

export INTROSPECTION_CHANGED_COUNT=$(git diff-tree --no-commit-id --name-only -r $LAST_COMMIT introspection | wc -l)
if [ $INTROSPECTION_CHANGED_COUNT -gt 0 ]; then
  export INTROSPECTION_CHANGED=true
fi

if [ -z "$CLI_CHANGE" ] && [ -z "$PRISMA2_CHANGED" ] && [ -z "$INTROSPECTION_CHANGED" ]; then
  echo "No change."
  exit 0
fi

buildkite-agent pipeline upload .buildkite/pipeline.yml