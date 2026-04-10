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
import { loadConfig, configSummary } from './config.js';
import { log, setLogLevel } from './logger.js';
import { createServer } from './server.js';

async function bootstrap(): Promise<void> {
  log('info', 'server starting', { operation: 'server_init' });

  const config = loadConfig();
  setLogLevel(config.logLevel);
  log('info', 'config loaded', { operation: 'config_load', ...configSummary(config) });

  const client = new BitbucketClient(config);
  const cache = new Cache(config.cache);
  const server = createServer(config, client, cache);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('info', 'server ready', { operation: 'server_init', transport: 'stdio' });

  const shutdown = async () => {
    log('info', 'server shutting down', { operation: 'server_shutdown' });
    cache.clear();
    await server.close();
    log('info', 'server stopped', { operation: 'server_shutdown' });
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err: unknown) => {
  log('error', 'fatal error during bootstrap', {
    operation: 'server_init',
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
