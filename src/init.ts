/*
 * CLI init command for scaffolding a bitbucket-mcp config file.
 * This is a CLI-only entrypoint that never calls loadConfig() or
 * loadServerConfig(); the env reads here match the narrow exception
 * documented in docs/plans/phase-7/feat-output-token-limits/plan.md
 * under 'Env reads stay confined to src/config.ts'.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { DEFAULT_MAX_OUTPUT_TOKENS, serverConfigSchema } from './config.js';
import { getConfigDir } from './paths.js';

import type { ConfigDirOverrides } from '@types';

export type RunInitDeps = {
  readonly fileExists?: (filePath: string) => Promise<boolean>;
  readonly writeConfig?: (filePath: string, contents: string) => Promise<void>;
  readonly write?: (chunk: string) => void;
  readonly writeErr?: (chunk: string) => void;
  readonly exit?: (code: number) => never;
};

async function parseArgs(args: readonly string[]): Promise<{
  configPath?: string;
  maxOutputTokens: number;
  force: boolean;
}> {
  let configPath: string | undefined;
  let maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--config-path') {
      if (i + 1 >= args.length) {
        throw new Error('--config-path requires a value');
      }
      const nextArg = args[i + 1];
      if (nextArg === undefined) {
        throw new Error('--config-path requires a value');
      }
      configPath = nextArg;
      i++;
    } else if (arg === '--max-output-tokens') {
      if (i + 1 >= args.length) {
        throw new Error('--max-output-tokens requires a value');
      }
      const nextArg = args[i + 1];
      if (nextArg === undefined) {
        throw new Error('--max-output-tokens requires a value');
      }
      const value = parseInt(nextArg, 10);
      if (Number.isNaN(value) || value <= 0) {
        throw new Error(`--max-output-tokens must be a positive integer, got: ${nextArg}`);
      }
      maxOutputTokens = value;
      i++;
    } else if (arg === '-y') {
      force = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { configPath, maxOutputTokens, force };
}

export async function runInit(args: readonly string[], deps?: RunInitDeps): Promise<void> {
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

  const writeConfig =
    deps?.writeConfig ??
    ((filePath: string, contents: string) => fs.writeFile(filePath, contents, 'utf8'));

  const write = deps?.write ?? process.stdout.write.bind(process.stdout);
  const writeErr = deps?.writeErr ?? process.stderr.write.bind(process.stderr);
  const exit = deps?.exit ?? (process.exit as (code: number) => never);

  let parsed: { configPath?: string; maxOutputTokens: number; force: boolean } | undefined;

  // Parse command-line arguments; user-input errors call exit(1) immediately
  try {
    parsed = await parseArgs(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeErr(`${message}\n`);
    exit(1);
  }

  // If we reach here, parseArgs succeeded and parsed is assigned (exit(1) above is never-returning)
  if (!parsed) {
    // This branch is unreachable but helps TypeScript's type narrowing
    throw new Error('parseArgs did not complete');
  }

  let configPath: string;
  let usingDefaultPath: boolean;

  if (parsed.configPath) {
    configPath = parsed.configPath;
    usingDefaultPath = false;
  } else {
    // Read env vars for XDG path resolution
    const overrides: ConfigDirOverrides = {
      configDirOverride: process.env.BITBUCKET_MCP_CONFIG_DIR,
      xdgConfigHome: process.env.XDG_CONFIG_HOME,
    };
    const configDir = getConfigDir(overrides);
    configPath = path.join(configDir, 'config.json');
    usingDefaultPath = true;
  }

  try {
    // Check if file exists
    const exists = await fileExists(configPath);
    if (exists && !parsed.force) {
      writeErr(`bitbucket-mcp init: ${configPath} already exists (pass -y to overwrite)\n`);
      exit(1);
    }

    // Build config contents
    const configContents = {
      $schema: './bitbucket-mcp.config.schema.json',
      defaults: {
        maxOutputTokens: parsed.maxOutputTokens,
      },
      tools: {},
    };

    // Validate config against schema
    serverConfigSchema.parse(configContents);

    // Create parent directory if using default path
    if (usingDefaultPath) {
      const parentDir = path.dirname(configPath);
      await fs.mkdir(parentDir, { recursive: true });
    } else if (!exists) {
      // For explicit --config-path, fail if parent doesn't exist
      const parentDir = path.dirname(configPath);
      try {
        await fs.stat(parentDir);
      } catch {
        writeErr(`Parent directory does not exist: ${parentDir}\n`);
        exit(1);
      }
    }

    // Write config file
    const jsonString = JSON.stringify(configContents, null, 2) + '\n';
    await writeConfig(configPath, jsonString);

    // Print success message and env line
    write(`Wrote ${configPath}\n`);
    write(`Add this to your MCP client's env for atlassian-bitbucket-mcp:\n`);
    write(`  BITBUCKET_MCP_CONFIG=${path.resolve(configPath)}\n`);
  } catch (err) {
    // Only reached for unexpected errors (e.g., fs errors after validation passes).
    // User-input errors call exit() directly and never reach here.
    // In tests, exit() is mocked to throw; we let that propagate to assert.rejects().
    if (err instanceof Error && err.message.startsWith('CLI_EXIT:')) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    writeErr(`${message}\n`);
    throw err;
  }
}
