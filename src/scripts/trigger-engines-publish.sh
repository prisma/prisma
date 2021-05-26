#!/bin/bash
# branch in the prisma-engines branch
# commit is the prisma-engines commit that you would like to publish (requires that binaries have been published)
curl -H "Authorization: token $GH_TOKEN" \
--request POST \
--data '{"event_type": "publish-engines", "client_payload": {"branch": "napi/version-function", "commit": "4165db0d1bddd480461f721ad5447bb261727728"}}' \
https://api.github.com/repos/prisma/prisma/dispatches
