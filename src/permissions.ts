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

export class ScopeDeniedError extends Error {
  readonly project: string;
  readonly repo?: string;

  constructor(project: string, repo?: string) {
    const target = repo !== undefined ? `${project}/${repo}` : project;
    const envVar = repo !== undefined ? 'BITBUCKET_ALLOWED_REPOS' : 'BITBUCKET_ALLOWED_PROJECTS';
    super(`Access to "${target}" is not permitted by ${envVar}`);
    this.name = 'ScopeDeniedError';
    this.project = project;
    if (repo !== undefined) this.repo = repo;
  }
}

/**
 * Enforce the configured project/repo allow-list. An empty allow-list means
 * "all allowed". Comparison is case-insensitive; a repo may be allowed either
 * as a fully qualified `project/repo` entry or as a bare `repo` slug.
 */
export function requireScope(config: Config, project: string, repo?: string): void {
  const p = project.trim().toLowerCase();

  if (config.allowedProjects.size > 0 && !config.allowedProjects.has(p)) {
    throw new ScopeDeniedError(project);
  }

  if (repo !== undefined && config.allowedRepos.size > 0) {
    const r = repo.trim().toLowerCase();
    if (!config.allowedRepos.has(`${p}/${r}`) && !config.allowedRepos.has(r)) {
      throw new ScopeDeniedError(project, repo);
    }
  }
}
