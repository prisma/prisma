source .env.production
gcloud functions deploy photonExample --stage-bucket $BUCKET --trigger-http --runtime nodejs10 --env-vars-file .env.yaml