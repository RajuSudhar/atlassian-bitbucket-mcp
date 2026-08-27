import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { log, setLogLevel } from '../dist/src/logger.js';

let lines;
let originalWrite;

function capture() {
  lines = [];
  originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    lines.push(String(chunk));
    return true;
  };
}

describe('Unit: logger', () => {
  beforeEach(() => {
    setLogLevel('debug');
    capture();
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
    setLogLevel('info');
  });

  it('should redact values under credential-shaped keys', () => {
    log('info', 'msg', { token: 'BBDC-supersecretvalue1234567890' });
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.token, '[REDACTED]');
  });

  it('should redact Bearer token-shaped values regardless of key', () => {
    log('info', 'auth', { header: 'Bearer BBDCabcdefghijklmnopqrstuvwxyz0123456789' });
    const entry = JSON.parse(lines[0]);
    assert.ok(!entry.header.includes('BBDCabcdefghijklmnopqrstuvwxyz'));
    assert.ok(entry.header.includes('[REDACTED]'));
  });

  it('should preserve short human-readable messages', () => {
    log('info', 'ok', { endpoint: '/projects/BZ/repos/nimble' });
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.endpoint, '/projects/BZ/repos/nimble');
  });

  it('should suppress log entries below the current level', () => {
    setLogLevel('error');
    log('info', 'should not appear');
    assert.equal(lines.length, 0);
  });
});
