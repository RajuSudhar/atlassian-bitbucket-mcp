/*
 * Permission enforcement — evaluated before any tool calls the client.
 */

import type { Action, Config } from '@types';

export class PermissionDeniedError extends Error {
  readonly action: Action;

  constructor(action: Action) {
    super(`Action "${action}" is not permitted by BITBUCKET_ALLOWED_ACTIONS`);
    this.name = 'PermissionDeniedError';
    this.action = action;
  }
}

export function requirePermission(config: Config, action: Action): void {
  if (!config.allowedActions.has(action)) {
    throw new PermissionDeniedError(action);
  }
}
