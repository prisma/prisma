#!/bin/bash

until (mongo admin --quiet --host mongo --port 27018 --eval "db"); do sleep 3; done
mongo admin --host mongo --port 27018 --eval "db.runCommand({ replSetInitiate: { _id: 'rs0', members: [{_id: 0, host: 'localhost:27018'}]} })" || true
mongo admin --host mongo --port 27018 --eval "db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })" || true
echo "REPLICA SET ONLINE"
