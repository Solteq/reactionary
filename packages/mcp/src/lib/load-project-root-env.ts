import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const workspaceRootMarkers = ['nx.json', 'pnpm-workspace.yaml'];

export function loadProjectRootEnv(
  from: string | URL = import.meta.url,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const envPath = env['DOTENV_CONFIG_PATH'] ?? resolveProjectRootEnvPath(from);

  if (!envPath) {
    config();
    return;
  }

  const result = config({ path: envPath });
  if (!result.error) {
    return;
  }

  const errorCode = (result.error as NodeJS.ErrnoException).code;
  if (errorCode === 'ENOENT' && env['DOTENV_CONFIG_PATH'] === undefined) {
    return;
  }

  throw result.error;
}

export function resolveProjectRootEnvPath(
  from: string | URL = import.meta.url,
): string | undefined {
  let currentDirectory = dirname(fileURLToPath(from));

  while (true) {
    if (
      workspaceRootMarkers.some((marker) =>
        existsSync(join(currentDirectory, marker)),
      )
    ) {
      return join(currentDirectory, '.env');
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}