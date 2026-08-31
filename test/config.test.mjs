import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { loadConfig, loadServerConfig, resolveMaxOutputTokens } from '../dist/src/config.js';

const BASE_ENV = {
  BITBUCKET_URL: 'https://bitbucket.juspay.net',
  BITBUCKET_TOKEN: 'BBDC-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  BITBUCKET_DEFAULT_PROJECT: 'BZ',
};

describe('Unit: loadConfig', () => {
  let saved;

  beforeEach(() => {
    saved = process.env;
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = saved;
  });

  it('should load the required Server/DC config', () => {
    const config = loadConfig();
    assert.equal(config.bitbucketUrl, 'https://bitbucket.juspay.net');
    assert.equal(config.defaultProject, 'BZ');
    assert.equal(config.bitbucketToken, BASE_ENV.BITBUCKET_TOKEN);
  });

  it('should strip trailing slashes from the URL', () => {
    process.env.BITBUCKET_URL = 'https://bitbucket.juspay.net///';
    assert.equal(loadConfig().bitbucketUrl, 'https://bitbucket.juspay.net');
  });

  it('should reject non-HTTPS URLs', () => {
    process.env.BITBUCKET_URL = 'http://bitbucket.juspay.net';
    assert.throws(() => loadConfig());
  });

  it('should default to all actions when unset', () => {
    const config = loadConfig();
    for (const action of [
      'read_pr',
      'write_pr',
      'manage_pr',
      'search_code',
      'read_repo',
      'read_project',
    ]) {
      assert.ok(config.allowedActions.has(action));
    }
  });

  it('should parse a restricted, whitespace-tolerant action list', () => {
    process.env.BITBUCKET_ALLOWED_ACTIONS = ' read_pr , write_pr ';
    const config = loadConfig();
    assert.ok(config.allowedActions.has('read_pr'));
    assert.ok(config.allowedActions.has('write_pr'));
    assert.ok(!config.allowedActions.has('manage_pr'));
  });

  it('should fail fast on an unknown action', () => {
    process.env.BITBUCKET_ALLOWED_ACTIONS = 'read_pr,delete_everything';
    assert.throws(() => loadConfig(), /Unknown action/);
  });

  it('should default allowed projects and repos to empty (all allowed)', () => {
    const config = loadConfig();
    assert.equal(config.allowedProjects.size, 0);
    assert.equal(config.allowedRepos.size, 0);
  });

  it('should parse and normalize allowed projects/repos to lowercase', () => {
    process.env.BITBUCKET_ALLOWED_PROJECTS = 'BZ, PLATFORM';
    process.env.BITBUCKET_ALLOWED_REPOS = 'BZ/Nimble, shared-lib';
    const config = loadConfig();
    assert.ok(config.allowedProjects.has('bz'));
    assert.ok(config.allowedProjects.has('platform'));
    assert.ok(config.allowedRepos.has('bz/nimble'));
    assert.ok(config.allowedRepos.has('shared-lib'));
  });

  it('should fail https mode without TLS cert/key files', () => {
    process.env.MCP_TRANSPORT = 'https';
    assert.throws(() => loadConfig(), /MCP_HTTP_TLS_CERT_FILE and MCP_HTTP_TLS_KEY_FILE/);
  });

  it('should fail https mode when only one TLS file is set', () => {
    process.env.MCP_TRANSPORT = 'https';
    process.env.MCP_HTTP_TLS_CERT_FILE = '/tmp/localhost.pem';
    assert.throws(() => loadConfig(), /MCP_HTTP_TLS_CERT_FILE and MCP_HTTP_TLS_KEY_FILE/);
  });

  it('should populate transport.tls in https mode with cert and key set', () => {
    process.env.MCP_TRANSPORT = 'https';
    process.env.MCP_HTTP_TLS_CERT_FILE = '/tmp/localhost.pem';
    process.env.MCP_HTTP_TLS_KEY_FILE = '/tmp/localhost-key.pem';
    const config = loadConfig();
    assert.equal(config.transport.mode, 'https');
    assert.deepEqual(config.transport.tls, {
      certFile: '/tmp/localhost.pem',
      keyFile: '/tmp/localhost-key.pem',
    });
  });

  it('should leave transport.tls unset in http mode even when TLS files are set', () => {
    process.env.MCP_TRANSPORT = 'http';
    process.env.MCP_HTTP_TLS_CERT_FILE = '/tmp/localhost.pem';
    process.env.MCP_HTTP_TLS_KEY_FILE = '/tmp/localhost-key.pem';
    const config = loadConfig();
    assert.equal(config.transport.mode, 'http');
    assert.equal(config.transport.tls, undefined);
  });
});

describe('Unit: loadServerConfig / resolveMaxOutputTokens', () => {
  let saved;

  beforeEach(() => {
    saved = process.env;
    process.env = { ...BASE_ENV }; // Start fresh from BASE_ENV
  });

  afterEach(() => {
    process.env = saved;
  });

  it('should reject BITBUCKET_MCP_CONFIG pointing to a missing absolute path', async () => {
    process.env.BITBUCKET_MCP_CONFIG = '/absolute/path/that/does/not/exist.json';
    delete process.env.BITBUCKET_MCP_CONFIG_DIR;
    delete process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS;
    delete process.env.XDG_CONFIG_HOME;

    await assert.rejects(
      () => loadServerConfig(),
      (err) =>
        err.message.includes('BITBUCKET_MCP_CONFIG') &&
        err.message.includes('/absolute/path/that/does/not/exist.json')
    );
  });

  it('should throw on relative path in BITBUCKET_MCP_CONFIG', async () => {
    process.env.BITBUCKET_MCP_CONFIG = 'relative/path.json';
    delete process.env.BITBUCKET_MCP_CONFIG_DIR;
    delete process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS;
    delete process.env.XDG_CONFIG_HOME;

    await assert.rejects(
      () => loadServerConfig(),
      (err) => err.message.includes('BITBUCKET_MCP_CONFIG must be an absolute path')
    );
  });

  it('should prefer cwd config.json over XDG path when both exist', async () => {
    delete process.env.BITBUCKET_MCP_CONFIG;
    delete process.env.BITBUCKET_MCP_CONFIG_DIR;
    delete process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS;
    delete process.env.XDG_CONFIG_HOME;

    const cwdConfig = JSON.stringify({ defaults: { maxOutputTokens: 5000 } });
    const xdgConfig = JSON.stringify({ defaults: { maxOutputTokens: 15000 } });

    let readFileCallOrder = [];
    const result = await loadServerConfig({
      readFile: async (filePath) => {
        if (filePath.endsWith('bitbucket-mcp.config.json')) {
          readFileCallOrder.push('cwd');
          return cwdConfig;
        }
        if (filePath.includes('bitbucket-mcp') && filePath.includes('config.json')) {
          readFileCallOrder.push('xdg');
          return xdgConfig;
        }
        throw new Error(`Unexpected path: ${filePath}`);
      },
      fileExists: async (filePath) => {
        if (filePath.endsWith('bitbucket-mcp.config.json')) {
          return true; // cwd config exists
        }
        if (filePath.includes('bitbucket-mcp') && filePath.includes('config.json')) {
          return true; // xdg config exists
        }
        return false;
      },
    });

    // Verify readFile was called for cwd first
    assert.ok(readFileCallOrder.includes('cwd'), 'should have tried to read cwd config');
    assert.ok(
      !readFileCallOrder.includes('xdg'),
      'XDG readFile must not be invoked when cwd config is found'
    );
    assert.equal(
      result.defaults.maxOutputTokens,
      5000,
      'should use cwd config value (5000), not xdg (15000)'
    );
  });

  it('should apply BITBUCKET_MCP_MAX_OUTPUT_TOKENS as override to defaults.maxOutputTokens', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = '50000';
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({ defaults: { maxOutputTokens: 5000 } });

    const result = await loadServerConfig({
      readFile: async () => config,
      fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
    });

    assert.equal(result.defaults.maxOutputTokens, 50000, 'env var should override file default');
  });

  it('should reject invalid BITBUCKET_MCP_MAX_OUTPUT_TOKENS', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = 'not_a_number';
    process.env.XDG_CONFIG_HOME = undefined;

    await assert.rejects(
      () => loadServerConfig({ fileExists: async () => false }),
      (err) => err.message.includes('BITBUCKET_MCP_MAX_OUTPUT_TOKENS')
    );
  });

  it('should reject negative BITBUCKET_MCP_MAX_OUTPUT_TOKENS', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = '-100';
    process.env.XDG_CONFIG_HOME = undefined;

    await assert.rejects(
      () => loadServerConfig({ fileExists: async () => false }),
      (err) => err.message.includes('BITBUCKET_MCP_MAX_OUTPUT_TOKENS')
    );
  });

  it('should use tool-specific maxOutputTokens when available', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = '20000'; // env override
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({
      defaults: { maxOutputTokens: 10000 },
      tools: {
        list_repos: { maxOutputTokens: 5000 },
        search_code: { maxOutputTokens: 15000 },
      },
    });

    const result = await loadServerConfig({
      readFile: async () => config,
      fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
    });

    // list_repos tool-specific value should be used (not env override)
    assert.equal(
      resolveMaxOutputTokens(result, 'list_repos'),
      5000,
      'tool-specific value should override env'
    );

    // search_code tool-specific value should be used
    assert.equal(
      resolveMaxOutputTokens(result, 'search_code'),
      15000,
      'different tool should use its own value'
    );

    // A tool without specific config should use env-overridden default
    assert.equal(
      resolveMaxOutputTokens(result, 'other_tool'),
      20000,
      'tool without specific config should use env-overridden default'
    );
  });

  it('should reject unknown top-level keys', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({ defaults: {}, tools: {}, unknownKey: 'value' });

    await assert.rejects(
      () =>
        loadServerConfig({
          readFile: async () => config,
          fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
        }),
      (err) => err.message.includes('unrecognized_keys')
    );
  });

  it('should reject unknown per-tool keys', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({
      defaults: {},
      tools: {
        some_tool: { maxOutputTokens: 10000, unknownKey: 'value' },
      },
    });

    await assert.rejects(
      () =>
        loadServerConfig({
          readFile: async () => config,
          fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
        }),
      (err) => err.message.includes('unrecognized_keys')
    );
  });

  it('should accept and ignore $schema key at top level', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({
      $schema: './bitbucket-mcp.config.schema.json',
      defaults: { maxOutputTokens: 8000 },
      tools: {},
    });

    const result = await loadServerConfig({
      readFile: async () => config,
      fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
    });

    assert.equal(result.defaults.maxOutputTokens, 8000, 'should parse config correctly');
    // The $schema key is not present in the returned object
    assert.ok(!('$schema' in result), '$schema key should not be in result');
  });

  it('should return defaults with built-in DEFAULT_MAX_OUTPUT_TOKENS when no config exists', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const result = await loadServerConfig({
      fileExists: async () => false, // no config files exist
    });

    assert.equal(
      result.defaults.maxOutputTokens,
      undefined,
      'defaults should not set maxOutputTokens'
    );
    assert.deepEqual(result.tools, {}, 'tools should be empty');
    assert.equal(
      resolveMaxOutputTokens(result),
      25000,
      'should resolve to DEFAULT_MAX_OUTPUT_TOKENS (25000) when nothing is configured'
    );
  });

  it('should resolve correct token limit without toolName', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({
      defaults: { maxOutputTokens: 12000 },
      tools: {},
    });

    const result = await loadServerConfig({
      readFile: async () => config,
      fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
    });

    assert.equal(
      resolveMaxOutputTokens(result),
      12000,
      'resolveMaxOutputTokens without toolName should use default'
    );
  });

  it('should handle invalid JSON in config file', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    await assert.rejects(
      () =>
        loadServerConfig({
          readFile: async () => 'not valid json {',
          fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
        }),
      (err) => err.message.includes('Invalid JSON')
    );
  });

  it('should normalize tools to empty object if absent in file', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({ defaults: { maxOutputTokens: 15000 } }); // no tools key

    const result = await loadServerConfig({
      readFile: async () => config,
      fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
    });

    assert.deepEqual(result.tools, {}, 'tools should be normalized to empty object');
  });

  it('should normalize defaults to empty object if absent in file', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = undefined;
    process.env.XDG_CONFIG_HOME = undefined;

    const config = JSON.stringify({ tools: { some_tool: { maxOutputTokens: 5000 } } }); // no defaults key

    const result = await loadServerConfig({
      readFile: async () => config,
      fileExists: async (filePath) => filePath.includes('bitbucket-mcp.config.json'),
    });

    assert.deepEqual(result.defaults, {}, 'defaults should be normalized to empty object');
    assert.equal(
      resolveMaxOutputTokens(result, 'some_tool'),
      5000,
      'should still resolve tool-specific value'
    );
  });

  it('should reject zero value for BITBUCKET_MCP_MAX_OUTPUT_TOKENS', async () => {
    process.env.BITBUCKET_MCP_CONFIG = undefined;
    process.env.BITBUCKET_MCP_CONFIG_DIR = undefined;
    process.env.BITBUCKET_MCP_MAX_OUTPUT_TOKENS = '0';
    process.env.XDG_CONFIG_HOME = undefined;

    await assert.rejects(
      () => loadServerConfig({ fileExists: async () => false }),
      /positive|greater than 0|invalid/i
    );
  });
});
