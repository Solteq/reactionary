import { config } from 'dotenv';

export interface LoadCwdEnvOptions {
  env?: NodeJS.ProcessEnv;
}

export function loadCwdEnv(options: LoadCwdEnvOptions = {}): void {
  const env = options.env ?? process.env;
  const result = env['DOTENV_CONFIG_PATH']
    ? config({ path: env['DOTENV_CONFIG_PATH'] })
    : config();
  if (!result.error) {
    return;
  }

  const errorCode = (result.error as NodeJS.ErrnoException).code;
  if (errorCode === 'ENOENT' && env['DOTENV_CONFIG_PATH'] === undefined) {
    return;
  }

  throw result.error;
}
