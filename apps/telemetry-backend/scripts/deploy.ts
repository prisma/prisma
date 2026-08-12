import { fileURLToPath } from 'node:url';

import { BuildError, BunBuild, ComputeClient } from '@prisma/compute-sdk';
import { createManagementApiClient } from '@prisma/management-api-sdk';

const token = process.env.TELEMETRY_DEPLOY_SERVICE_TOKEN;
if (!token) {
  throw new Error('TELEMETRY_DEPLOY_SERVICE_TOKEN not set');
}

const projectId = process.env.TELEMETRY_DEPLOY_PROJECT_ID;
if (!projectId) {
  throw new Error('TELEMETRY_DEPLOY_PROJECT_ID not set');
}

const serviceId = process.env.TELEMETRY_DEPLOY_SERVICE_ID;
if (!serviceId) {
  throw new Error('TELEMETRY_DEPLOY_SERVICE_ID not set');
}

const api = createManagementApiClient({ token });
const compute = new ComputeClient(api);

const result = await compute.deploy({
  strategy: new BunBuild({
    appPath: fileURLToPath(new URL('..', import.meta.url)),
    entrypoint: 'src/server.ts',
  }),
  projectId,
  serviceId,
  progress: {
    onBuildStart() {
      console.log('Building application...');
    },
    onBuildComplete(artifact) {
      console.log(`Build complete: ${artifact.directory}/${artifact.entrypoint}`);
    },
    onArchiveCreating() {
      console.log('Creating archive...');
    },
    onArchiveReady(sizeBytes) {
      console.log(`Archive ready (${sizeBytes} bytes)`);
    },
    onVersionCreated(versionId) {
      console.log(`Version created: ${versionId}`);
    },
    onUploadStart() {
      console.log('Uploading archive...');
    },
    onUploadComplete() {
      console.log('Upload complete');
    },
    onStartRequested() {
      console.log('Start requested');
    },
    onStatusChange(status) {
      console.log(`Status: ${status}`);
    },
    onRunning(deploymentUrl) {
      console.log(`Deployment running at ${deploymentUrl}`);
    },
    onPromoteStart() {
      console.log('Promoting new version...');
    },
    onPromoted(serviceEndpointDomain) {
      console.log(`Promoted: ${serviceEndpointDomain}`);
    },
    onPromoteFailed(error) {
      console.error(`Promote failed: ${error}`);
    },
    onOldVersionStopping(versionId) {
      console.log(`Stopping old version ${versionId}...`);
    },
    onOldVersionStopped(versionId) {
      console.log(`Stopped old version ${versionId}`);
    },
    onOldVersionStopFailed(versionId) {
      console.error(`Failed to stop old version ${versionId}`);
    },
    onOldVersionDeleting(versionId) {
      console.log(`Deleting old version ${versionId}...`);
    },
    onOldVersionDeleted(versionId) {
      console.log(`Deleted old version ${versionId}`);
    },
    onOldVersionDeleteFailed(versionId) {
      console.error(`Failed to delete old version ${versionId}`);
    },
    onCleanupDanglingVersion(versionId) {
      console.log(`Cleaning up dangling version ${versionId}...`);
    },
    onCleanupDanglingVersionComplete(versionId) {
      console.log(`Cleaned up dangling version ${versionId}`);
    },
    onCleanupDanglingVersionFailed(versionId) {
      console.error(`Failed to clean up dangling version ${versionId}`);
    },
  },
});

result.match({
  ok: (deployment) => {
    console.log('Deploy succeeded:');
    console.log(`  version:     ${deployment.versionId}`);
    console.log(`  version URL: ${deployment.versionEndpointDomain}`);
    if (deployment.promoted && deployment.serviceEndpointDomain) {
      console.log(`  service URL: ${deployment.serviceEndpointDomain}`);
    }
    if (deployment.previousVersionId) {
      console.log(
        `  previous version ${deployment.previousVersionId}: ${deployment.previousVersionAction ?? 'unchanged'}`,
      );
    }
  },
  err: (error) => {
    console.error(`Deploy failed [${error._tag}]: ${error.message}`);
    if (BuildError.is(error) && error.logs?.length) {
      console.error(error.logs.join('\n'));
    }
    process.exit(1);
  },
});
