FROM mongo:5

COPY init.json /init.json

CMD mongoimport --uri mongodb://root:prisma@mongo_migrate:27017/tests-migrate?authSource=admin --collection users --type json --file /init.json --jsonArray
