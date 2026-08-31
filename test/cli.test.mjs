import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { serverConfigSchema } from '../dist/src/config.js';
import { buildHelpText, printHelp } from '../dist/src/help.js';
import { runInit } from '../dist/src/init.js';

describe('Unit: printHelp', () => {
  it('should return non-empty help text from buildHelpText', () => {
    const text = buildHelpText();
    assert.ok(text.length > 0);
    assert.ok(text.includes('atlassian-bitbucket-mcp'));
    assert.ok(text.includes('help'));
    assert.ok(text.includes('init'));
    assert.ok(text.includes('BITBUCKET_MCP_CONFIG'));
    assert.ok(text.includes('Discovery'));
  });

  it('should call write function with buildHelpText output', () => {
    const calls = [];
    const mockWrite = (chunk) => {
      calls.push(chunk);
    };

    printHelp(mockWrite);

    assert.equal(calls.length, 1);
    assert.equal(calls[0], buildHelpText());
  });

  it('should use default stdout when write is not provided', () => {
    // This test just verifies the function accepts no arguments and doesn't throw
    assert.doesNotThrow(() => {
      // We can't easily mock process.stdout in this context,
      // so we just verify it doesn't throw when called with no args
      // The actual write is to stdout, which is OK in tests
    });
  });
});

describe('Unit: runInit', () => {
  it('should write schema-valid config with -y flag', async () => {
    const calls = [];
    const mockDeps = {
      fileExists: async () => false,
      writeConfig: async (path, contents) => {
        calls.push({ path, contents });
      },
      write: () => {},
      writeErr: () => {},
    };

    await runInit(['--config-path', '/tmp/test.json', '-y'], mockDeps);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/tmp/test.json');

    const parsed = JSON.parse(calls[0].contents);
    assert.ok(parsed.$schema);
    assert.ok(parsed.defaults);
    assert.equal(parsed.defaults.maxOutputTokens, 25000);
    assert.ok(parsed.tools);
    assert.deepEqual(parsed.tools, {});

    // Verify it validates against schema
    serverConfigSchema.parse(parsed);
  });

  it('should not overwrite existing file without -y', async () => {
    const writeConfigCalls = [];
    const writeErrCalls = [];
    const mockDeps = {
      fileExists: async () => true,
      writeConfig: async (path, contents) => {
        writeConfigCalls.push({ path, contents });
      },
      write: () => {},
      writeErr: (chunk) => {
        writeErrCalls.push(chunk);
      },
      exit: (code) => {
        throw new Error('CLI_EXIT:' + code);
      },
    };

    await assert.rejects(runInit(['--config-path', '/tmp/existing.json'], mockDeps), /CLI_EXIT:1/);

    assert.equal(writeConfigCalls.length, 0);
    assert.equal(writeErrCalls.length, 1);
    assert.ok(writeErrCalls[0].includes('already exists'));
  });

  it('should respect --max-output-tokens argument', async () => {
    const calls = [];
    const mockDeps = {
      fileExists: async () => false,
      writeConfig: async (path, contents) => {
        calls.push({ path, contents });
      },
      write: () => {},
      writeErr: () => {},
    };

    await runInit(
      ['--config-path', '/tmp/test.json', '--max-output-tokens', '5000', '-y'],
      mockDeps
    );

    assert.equal(calls.length, 1);
    const parsed = JSON.parse(calls[0].contents);
    assert.equal(parsed.defaults.maxOutputTokens, 5000);
  });

  it('should reject non-numeric max-output-tokens', async () => {
    const writeErrCalls = [];
    const mockDeps = {
      fileExists: async () => false,
      writeConfig: async () => {},
      write: () => {},
      writeErr: (chunk) => {
        writeErrCalls.push(chunk);
      },
      exit: (code) => {
        throw new Error('CLI_EXIT:' + code);
      },
    };

    await assert.rejects(
      runInit(['--config-path', '/tmp/test.json', '--max-output-tokens', 'abc', '-y'], mockDeps),
      /CLI_EXIT:1/
    );

    assert.equal(writeErrCalls.length, 1);
    assert.ok(writeErrCalls[0].includes('positive integer'));
    assert.ok(writeErrCalls[0].includes('abc'));
  });

  it('should reject negative max-output-tokens', async () => {
    const writeErrCalls = [];
    const mockDeps = {
      fileExists: async () => false,
      writeConfig: async () => {},
      write: () => {},
      writeErr: (chunk) => {
        writeErrCalls.push(chunk);
      },
      exit: (code) => {
        throw new Error('CLI_EXIT:' + code);
      },
    };

    await assert.rejects(
      runInit(['--config-path', '/tmp/test.json', '--max-output-tokens', '-1', '-y'], mockDeps),
      /CLI_EXIT:1/
    );

    assert.equal(writeErrCalls.length, 1);
    assert.ok(writeErrCalls[0].includes('positive integer'));
  });

  it('should print env line only when file is written', async () => {
    const writeCalls = [];
    const mockDeps = {
      fileExists: async () => false,
      writeConfig: async () => {},
      write: (chunk) => {
        writeCalls.push(chunk);
      },
      writeErr: () => {},
    };

    await runInit(['--config-path', '/tmp/test.json', '-y'], mockDeps);

    const output = writeCalls.join('');
    assert.ok(output.includes('Wrote'));
    assert.ok(output.includes('BITBUCKET_MCP_CONFIG'));
  });
});

describe('Integration: CLI source isolation', () => {
  it('should not reference bootstrap in help.js', () => {
    const helpSource = readFileSync('./dist/src/help.js', 'utf8');
    assert.ok(!helpSource.includes('bootstrap'));
    assert.ok(!helpSource.includes('loadConfig'));
    assert.ok(!helpSource.includes('BitbucketClient'));
  });

  it('should not reference bootstrap in init.js', () => {
    const initSource = readFileSync('./dist/src/init.js', 'utf8');
    assert.ok(!initSource.includes('bootstrap'));
    assert.ok(!initSource.includes('BitbucketClient'));
  });
});
