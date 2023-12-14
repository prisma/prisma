FROM mongo:4

COPY init.json /init.json

# https://docs.mongodb.com/database-tools/mongoimport/
# Drop and import collection
CMD mongoimport --uri mongodb://mongodb_migrate:27017/tests-migrate --drop --collection users --type json --file /init.json --jsonArray
