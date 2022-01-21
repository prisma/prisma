#!/bin/bash

# HOST=$(ping -c 1 mongo &> /dev/null && echo 'mongo:27018' || echo 'localhost:27018')

until (mongo admin --quiet --host mongo --port 27018 --eval "db"); do sleep 3; done
mongo admin --host mongo --port 27018 --eval "db.runCommand({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '$HOST' }] } })" || true
mongo admin --host mongo --port 27018 --eval "db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })" || true

echo "REPLICA SET ONLINE"
