FROM mongo:4

COPY init.json /init.json

CMD mongoimport --uri "mongodb://root:prisma@test-mongodb-db:27017/tests?authSource=admin&retryWrites=true&w=majority" --collection users --type json --file /init.json --jsonArray
