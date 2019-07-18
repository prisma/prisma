source .env.production
gcloud functions deploy photonExample --stage-bucket $BUCKET --trigger-http --runtime nodejs10 --set-env-vars POSTGRESQL_URL=$POSTGRESQL_URL --set-env-vars DEBUG=true