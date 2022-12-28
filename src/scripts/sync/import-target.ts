import type { requestsManager } from 'snyk-request-manager';
import * as debugLib from 'debug';
import { defaultExclusionGlobs } from '../../common';
import { importTarget, listIntegrations, pollImportUrls } from '../../lib';

import type {
  Project,
  Target,
  SupportedIntegrationTypesUpdateProject,
} from '../../lib/types';
import type { FailedProject } from '../../loggers/log-failed-projects';

const debug = debugLib('snyk:import-single-target');

export async function importSingleTarget(
  requestManager: requestsManager,
  orgId: string,
  integrationType: SupportedIntegrationTypesUpdateProject,
  target: Target,
  filesToImport: string[] = [],
  excludeFolders?: string,
  loggingPath?: string,
): Promise<{ projects: Project[]; failed: FailedProject[] }> {
  const integrationsData = await listIntegrations(requestManager, orgId);
  const integrationId = integrationsData[integrationType];
  const files = filesToImport.map((f) => ({ path: f }));
  const { pollingUrl } = await importTarget(
    requestManager,
    orgId,
    integrationId,
    target,
    files,
    `${excludeFolders}, ${defaultExclusionGlobs.join(',')}`,
    loggingPath,
  );

  debug(`Polling for updates`);
  const res = await pollImportUrls(requestManager, [pollingUrl]);
  debug(`Finished polling, discovered ${res.projects?.length} projects`);
  return res;
}