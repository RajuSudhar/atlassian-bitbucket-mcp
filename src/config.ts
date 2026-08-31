/*
 * Configuration loader — the ONLY file that reads process.env.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { z } from 'zod';

import { getConfigDir } from './paths.js';

import type {
  Action,
  Config,
  LoadServerConfigDeps,
  Seconds,
  ServerConfig,
  TlsConfig,
} from '@types';

const VALID_ACTIONS: ReadonlyArray<Action> = [
  'read_pr',
  'write_pr',
  'manage_pr',
  'search_code',
  'read_repo',
  'read_project',
];

const envSchema = z.object({
  BITBUCKET_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), { message: 'BITBUCKET_URL must use HTTPS' }),
  BITBUCKET_TOKEN: z.string().min(1, 'BITBUCKET_TOKEN is required'),
  BITBUCKET_DEFAULT_PROJECT: z.string().min(1, 'BITBUCKET_DEFAULT_PROJECT is required'),
  BITBUCKET_ALLOWED_ACTIONS: z.string().optional().default(''),
  BITBUCKET_ALLOWED_PROJECTS: z.string().optional().default(''),
  BITBUCKET_ALLOWED_REPOS: z.string().optional().default(''),
  BITBUCKET_CACHE_ENABLED: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true'),
  BITBUCKET_CACHE_TTL_REPOS: z.coerce.number().int().positive().optional().default(3600),
  BITBUCKET_CACHE_TTL_METADATA: z.coerce.number().int().positive().optional().default(1800),
  BITBUCKET_CACHE_TTL_USER: z.coerce.number().int().positive().optional().default(3600),
  BITBUCKET_REQUEST_TIMEOUT: z.coerce.number().int().positive().optional().default(30000),
  BITBUCKET_MAX_RETRIES: z.coerce.number().int().nonnegative().optional().default(3),
  BITBUCKET_RATE_LIMIT_DELAY: z.coerce.number().int().nonnegative().optional().default(0),
  MCP_TRANSPORT: z.enum(['stdio', 'http', 'https']).optional().default('stdio'),
  MCP_HTTP_PORT: z.coerce.number().int().positive().max(65535).optional().default(3900),
  MCP_HTTP_HOST: z.string().min(1).optional().default('127.0.0.1'),
  MCP_HTTP_TLS_CERT_FILE: z.string().min(1).optional(),
  MCP_HTTP_TLS_KEY_FILE: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
});

function parseAllowedActions(raw: string): ReadonlySet<Action> {
  if (raw.trim().length === 0) {
    return new Set(VALID_ACTIONS);
  }

  const actions = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const action of actions) {
    if (!VALID_ACTIONS.includes(action as Action)) {
      throw new Error(`Unknown action "${action}". Valid: ${VALID_ACTIONS.join(', ')}`);
    }
  }

  return new Set(actions as Action[]);
}

/**
 * Parse a comma-separated allow-list into a normalized lowercase set.
 * Empty / unset → empty set, which callers interpret as "all allowed".
 */
function parseScopeList(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function loadConfig(): Config {
  const parsed = envSchema.parse(process.env);

  let tls: TlsConfig | undefined;
  if (parsed.MCP_TRANSPORT === 'https') {
    const certFile = parsed.MCP_HTTP_TLS_CERT_FILE;
    const keyFile = parsed.MCP_HTTP_TLS_KEY_FILE;
    if (!certFile || !keyFile) {
      throw new Error(
        'MCP_TRANSPORT=https requires both MCP_HTTP_TLS_CERT_FILE and MCP_HTTP_TLS_KEY_FILE (paths to PEM files)'
      );
    }
    tls = { certFile, keyFile };
  }

  const config: Config = {
    bitbucketUrl: parsed.BITBUCKET_URL.replace(/\/+$/, ''),
    bitbucketToken: parsed.BITBUCKET_TOKEN,
    defaultProject: parsed.BITBUCKET_DEFAULT_PROJECT,
    allowedActions: parseAllowedActions(parsed.BITBUCKET_ALLOWED_ACTIONS),
    allowedProjects: parseScopeList(parsed.BITBUCKET_ALLOWED_PROJECTS),
    allowedRepos: parseScopeList(parsed.BITBUCKET_ALLOWED_REPOS),
    cache: {
      enabled: parsed.BITBUCKET_CACHE_ENABLED,
      ttlRepos: parsed.BITBUCKET_CACHE_TTL_REPOS as Seconds,
      ttlRepoMeta: parsed.BITBUCKET_CACHE_TTL_METADATA as Seconds,
      ttlUsers: parsed.BITBUCKET_CACHE_TTL_USER as Seconds,
    },
    api: {
      requestTimeout: parsed.BITBUCKET_REQUEST_TIMEOUT,
      maxRetries: parsed.BITBUCKET_MAX_RETRIES,
      rateLimitDelay: parsed.BITBUCKET_RATE_LIMIT_DELAY,
    },
    transport: {
      mode: parsed.MCP_TRANSPORT,
      httpPort: parsed.MCP_HTTP_PORT,
      httpHost: parsed.MCP_HTTP_HOST,
      ...(tls ? { tls } : {}),
    },
    logLevel: parsed.LOG_LEVEL,
  };

  return config;
}

/** Mask config for safe logging — strips token */
export function configSummary(config: Config): Record<string, unknown> {
  return {
    bitbucketUrl: config.bitbucketUrl,
    defaultProject: config.defaultProject,
    hasToken: Boolean(config.bitbucketToken),
    allowedActions: [...config.allowedActions],
    allowedProjects: config.allowedProjects.size > 0 ? [...config.allowedProjects] : 'all',
    allowedRepos: config.allowedRepos.size > 0 ? [...config.allowedRepos] : 'all',
    cache: config.cache,
    api: config.api,
    transport: config.transport,
    logLevel: config.logLevel,
  };
}

export const DEFAULT_MAX_OUTPUT_TOKENS = 25000;

const toolSettingsSchema = z
  .object({
    maxOutputTokens: z.number().int().positive().optional(),
  })
  .strict();

export const serverConfigSchema = z
  .object({
    $schema: z.string().optional(),
    defaults: toolSettingsSchema.optional(),
    tools: z.record(z.string(), toolSettingsSchema).optional(),
  })
  .strict();

async function resolveConfigPath(
  fileExists: (p: string) => Promise<boolean>
): Promise<string | null> {
  const explicit = process.env.BITBUCKET_MCP_CONFIG;
  if (explicit) {
    if (!path.isAbsolute(explicit)) {
      throw new Error(`BITBUCKET_MCP_CONFIG must be an absolute path, got: ${explicit}`);
    }
    if (!(await fileExists(explicit))) {
      throw new Error(`BITBUCKET_MCP_CONFIG points to a file that does not exist: ${explicit}`);
    }
    return explicit;
  }

  const cwdConfig = path.join(process.cwd(), 'bitbucket-mcp.config.json');
  if (await fileExists(cwdConfig)) {
    return cwdConfig;
  }

  const configDir = getConfigDir({
    configDirOverride: process.env.BITBUCKET_MCP_CONFIG_DIR,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
  });
  const xdgConfig = path.join(configDir, 'config.json');
  if (await fileExists(xdgConfig)) {
    return xdgConfig;
  }

  return null;
}

export async function loadServerConfig(deps?: LoadServerConfigDeps): Promise<ServerConfig> {
  const readFile = deps?.readFile ?? ((filePath: string) => fs.readFile(filePath, 'utf8'));
  const fileExists =
    deps?.fileExists ??
    (async (filePath: string) => {
      try {
        await fs.stat(filePath);
        return true;
      } catch {
        return false;
      }
    });

  const configPath = await resolveConfigPath(fileExists);

  type ValidatedConfig = z.infer<typeof serverConfigSchema>;
  let validated: ValidatedConfig;

  if (configPath) {
    try {
      const contents = await readFile(configPath);
      const parsed = JSON.parse(contents);
      validated = serverConfigSchema.parse(parsed);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON in config file ${configPath}: ${err.message}`);
      }
      throw err;
    }
  } else {
    validated = {};
  }

  const envOverride = process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS;
  if (envOverride) {
    try {
      const parsedValue = z.coerce.number().int().positive().parse(envOverride);
      validated.defaults = {
        ...(validated.defaults || {}),
        maxOutputTokens: parsedValue,
      };
    } catch {
      throw new Error(
        `BITBUCKET_MCP_MAX_OUTPUT_TOKENS must be a positive integer, got: ${envOverride}`
      );
    }
  }

  return {
    defaults: validated.defaults ?? {},
    tools: validated.tools ?? {},
  };
}

export function resolveMaxOutputTokens(governor: ServerConfig, toolName?: string): number {
  if (toolName && governor.tools[toolName]?.maxOutputTokens != null) {
    return governor.tools[toolName].maxOutputTokens;
  }
  return governor.defaults.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
}
