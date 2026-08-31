#!/usr/bin/env node
/*
 * Copyright (C) 2025 Sudharsan R <sudharsan1616@outlook.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { BitbucketClient } from './bitbucket/client.js';
import { Cache } from './cache.js';
import { loadConfig, configSummary, loadServerConfig } from './config.js';
import { printHelp } from './help.js';
import { startHttpTransport } from './http.js';
import { runInit } from './init.js';
import { log, setLogLevel } from './logger.js';
import { createServer } from './server.js';

async function bootstrap(): Promise<void> {
  log('info', 'server starting', { operation: 'server_init' });

  const config = loadConfig();
  setLogLevel(config.logLevel);
  log('info', 'config loaded', { operation: 'config_load', ...configSummary(config) });

  const governor = await loadServerConfig();

  const client = new BitbucketClient(config);
  const cache = new Cache(config.cache);

  // In http/https mode, transports (and their per-session server instances)
  // are created lazily by the HTTP layer; in stdio mode we connect a single one.
  let closeTransport: () => Promise<void>;

  if (config.transport.mode !== 'stdio') {
    const handle = await startHttpTransport(config, client, cache, governor);
    closeTransport = handle.close;
  } else {
    const server = createServer(config, client, cache, governor);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    closeTransport = () => server.close();
  }

  log('info', 'server ready', { operation: 'server_init', transport: config.transport.mode });

  const shutdown = async () => {
    log('info', 'server shutting down', { operation: 'server_shutdown' });
    cache.clear();
    await closeTransport();
    log('info', 'server stopped', { operation: 'server_shutdown' });
    process.exit(0);
  };

  const onSignal = () => {
    shutdown().catch((err: unknown) => {
      log('error', 'shutdown error', {
        operation: 'server_shutdown',
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
}

const [, , command, ...rest] = process.argv;

async function main(): Promise<void> {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command === 'init') {
    await runInit(rest);
    return;
  }
  await bootstrap();
}

main().catch((err: unknown) => {
  log('error', 'fatal error', {
    operation: 'server_init',
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
