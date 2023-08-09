FROM mongo:4@sha256:d67f68a9195b869e47937b3966e0c8d5994ef618bb4fec1d76108c020444d939

COPY init.json /init.json

# https://docs.mongodb.com/database-tools/mongoimport/
# Drop and import collection
CMD mongoimport --uri mongodb://root:prisma@mongodb_migrate:27017/tests-migrate?authSource=admin --drop --collection users --type json --file /init.json --jsonArray
