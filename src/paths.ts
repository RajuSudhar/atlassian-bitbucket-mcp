/*
 * XDG config directory resolution for the output-token-limit governor's
 * config file. Takes all inputs as parameters — process.env is read only
 * in src/config.ts, per the project's env-read rule.
 */

import * as os from 'node:os';
import * as path from 'node:path';

import type { ConfigDirOverrides } from '@types';

export function getConfigDir(overrides: ConfigDirOverrides = {}): string {
  if (overrides.configDirOverride) {
    return overrides.configDirOverride;
  }
  const base = overrides.xdgConfigHome ?? path.join(os.homedir(), '.config');
  return path.join(base, 'bitbucket-mcp');
}
