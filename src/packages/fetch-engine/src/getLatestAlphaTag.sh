
#!/bin/bash

set -e

RESULT=$(git ls-remote --tags https://github.com/prisma/prisma-engines | grep "\-alpha\." | sort -Vk2 | tail -1)

echo $RESULT