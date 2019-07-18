### Notes

Deploy via `gcloud functions deploy photonExample --stage-bucket <bucket-name> --trigger-http --runtime nodejs10`

1. If a post install hook is added, it breaks the deployment
   `gcloud functions deploy photonExample --stage-bucket divu-serverless --trigger-http --runtime nodejs10`

2. Need to move Photon out of `node_modules`

3. Fails at runtime with unhandled exception (maybe binary needs swapping, notified Tim for a better error log)
   https://user-images.githubusercontent.com/746482/60885437-e0d9d880-a24f-11e9-83b8-e8e49c1e7b2e.png

```
divyendusingh [gcp]$ gcloud functions deploy photonExample --stage-bucket divu-serverless --trigger-http --runtime nodejs10

Deploying function (may take a while - up to 2 minutes)...⠧
Deploying function (may take a while - up to 2 minutes)...failed.
ERROR: (gcloud.functions.deploy) OperationError: code=3, message=Function failed on loading user code. Error message: Provided module can't be loaded.
Did you list all required modules in the package.json dependencies?
Detailed stack trace: Error: Cannot find module '@generated/photon'
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:582:15)
    at Function.Module._load (internal/modules/cjs/loader.js:508:25)
    at Module.require (internal/modules/cjs/loader.js:637:17)
    at require (internal/modules/cjs/helpers.js:22:18)
    at Object.<anonymous> (/srv/functions/index.js:1:78)
    at Module._compile (internal/modules/cjs/loader.js:701:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:712:10)
    at Module.load (internal/modules/cjs/loader.js:600:32)
    at tryModuleLoad (internal/modules/cjs/loader.js:539:12)
    at Function.Module._load (internal/modules/cjs/loader.js:531:3)
Could not load the function, shutting down.
```

Swapping binary to `linux-glibc` worked.
