set -ex

echo "BUILDKITE_TAG"
echo $BUILDKITE_TAG

if [ "$DEVELOPMENT_ENVIRONMENT_COMMIT" ]; then
  git stash
  git checkout $DEVELOPMENT_ENVIRONMENT_COMMIT
fi


buildkite-agent pipeline upload .buildkite/publish/publish.yml