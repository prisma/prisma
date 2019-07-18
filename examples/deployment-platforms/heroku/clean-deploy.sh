heroku plugins:install heroku-repo
heroku repo:purge_cache -a photon-example-prisma2
git commit --allow-empty -m "Purge cache"
git push heroku master