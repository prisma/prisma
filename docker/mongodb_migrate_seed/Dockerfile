FROM mongo:6

COPY init.json /init.json

# https://docs.mongodb.com/database-tools/mongoimport/
# Drop and import collection
CMD mongoimport --uri mongodb://root:prisma@mongodb_migrate:27017/tests-migrate?authSource=admin --drop --collection users --type json --file /init.json --jsonArray
