/*
 * Streamable HTTP transport for the MCP server.
 *
 * Serves the same tool registry as the stdio entry point over HTTP so the
 * server can run as a long-lived local service and be registered as a Claude
 * HTTP MCP (`--transport http`). Sessions are stateful: an `initialize` POST
 * mints a session id (returned in the `mcp-session-id` header) that the client
 * echoes on subsequent POST/GET/DELETE requests.
 *
 * Bound to loopback by default. The endpoint is unauthenticated, so it must
 * never be exposed beyond 127.0.0.1 — the Bitbucket token lives behind it.
 */

import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { log } from './logger.js';
import { createServer } from './server.js';

import type { BitbucketClient } from './bitbucket/client.js';
import type { Cache } from './cache.js';
import type { Config } from '@types';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

const MCP_PATH = '/mcp';
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export type HttpTransportHandle = {
  readonly close: () => Promise<void>;
};

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function jsonRpcError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, {
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id: null,
  });
}

export async function startHttpTransport(
  config: Config,
  client: BitbucketClient,
  cache: Cache
): Promise<HttpTransportHandle> {
  const { httpHost, httpPort } = config.transport;
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer: Server = createHttpServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      log('error', 'http handler error', {
        operation: 'http_request',
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        jsonRpcError(res, 500, 'Internal server error');
      }
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    // Lightweight health probe for service supervisors / smoke tests.
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', transport: 'http', sessions: transports.size });
      return;
    }

    if (url.pathname !== MCP_PATH) {
      jsonRpcError(res, 404, `Not found. MCP endpoint is ${MCP_PATH}`);
      return;
    }

    const sessionId = req.headers['mcp-session-id'];
    const sid = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      let transport = sid ? transports.get(sid) : undefined;

      if (!transport && isInitializeRequest(body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            transports.set(id, transport as StreamableHTTPServerTransport);
            log('info', 'mcp session opened', { operation: 'http_session', sessionId: id });
          },
        });
        transport.onclose = () => {
          if (transport?.sessionId) {
            transports.delete(transport.sessionId);
            log('info', 'mcp session closed', {
              operation: 'http_session',
              sessionId: transport.sessionId,
            });
          }
        };
        const server = createServer(config, client, cache);
        await server.connect(transport);
      } else if (!transport) {
        jsonRpcError(res, 400, 'No valid session. Send an initialize request first.');
        return;
      }

      await transport.handleRequest(req, res, body);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      const transport = sid ? transports.get(sid) : undefined;
      if (!transport) {
        jsonRpcError(res, 400, 'Unknown or missing mcp-session-id');
        return;
      }
      await transport.handleRequest(req, res);
      return;
    }

    jsonRpcError(res, 405, `Method ${req.method ?? 'unknown'} not allowed`);
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(httpPort, httpHost, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  log('info', 'http transport listening', {
    operation: 'server_init',
    transport: 'http',
    host: httpHost,
    port: httpPort,
    endpoint: MCP_PATH,
  });

  return {
    close: async () => {
      for (const transport of transports.values()) {
        await transport.close().catch(() => undefined);
      }
      transports.clear();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
