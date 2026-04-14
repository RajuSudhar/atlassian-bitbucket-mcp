/*
 * Shared zod input schemas for MCP tools.
 *
 * A single source of truth consumed by:
 *   - `server.ts` — passed to `server.tool(name, desc, shape, handler)` as the
 *     raw shape the SDK uses to build the MCP tool descriptor.
 *   - `tools/*-tools.ts` — wrapped in `z.object(...)` inside each handler for
 *     runtime `.parse(args)` validation.
 *
 * Every schema is declared as a `ZodRawShape` (plain object of zod types) so
 * the MCP SDK and `z.object` can both accept it without shape/object confusion.
 */

import { z } from 'zod';

const project = z.string().min(1).describe('Project key');
const repo = z.string().min(1).describe('Repository slug');
const prId = z.coerce.number().int().positive().describe('Pull request ID');
const limit = z.coerce.number().int().positive().optional().describe('Max results');
const start = z.coerce.number().int().nonnegative().optional().describe('Pagination start');

// --- PR Tools ------------------------------------------------------------

export const listPullRequestsShape = {
  project,
  repo,
  state: z.string().optional().describe('PR state filter: OPEN, MERGED, DECLINED'),
  limit,
  start,
} as const;

export const prRefShape = { project, repo, prId } as const;

export const prPaginatedShape = { ...prRefShape, limit, start } as const;

export const addPrCommentShape = {
  ...prRefShape,
  text: z.string().min(1).describe('Comment text'),
} as const;

export const addPrInlineCommentShape = {
  ...prRefShape,
  text: z.string().min(1).describe('Comment text'),
  path: z.string().min(1).describe('File path'),
  line: z.coerce.number().int().positive().describe('Line number'),
  lineType: z.enum(['ADDED', 'REMOVED', 'CONTEXT']).describe('Line type'),
  fileType: z.enum(['FROM', 'TO']).optional().describe('File type'),
} as const;

export const replyToCommentShape = {
  ...prRefShape,
  commentId: z.coerce.number().int().positive().describe('Parent comment ID'),
  text: z.string().min(1).describe('Reply text'),
} as const;

export const resolveCommentShape = {
  ...prRefShape,
  commentId: z.coerce.number().int().positive().describe('Comment ID to resolve'),
  version: z.coerce.number().int().nonnegative().describe('Comment version for optimistic locking'),
} as const;

export const updateCommentShape = {
  ...prRefShape,
  commentId: z.coerce.number().int().positive().describe('Comment ID to edit'),
  text: z.string().min(1).describe('Updated comment text'),
  version: z.coerce.number().int().nonnegative().describe('Comment version for optimistic locking'),
} as const;

// --- Repo Tools ----------------------------------------------------------

export const listProjectsShape = { limit, start } as const;

export const projectListShape = { project, limit, start } as const;

export const repoRefShape = { project, repo } as const;

export const repoPaginatedShape = { ...repoRefShape, limit, start } as const;

export const getFileContentShape = {
  ...repoRefShape,
  path: z.string().min(1).describe('File path'),
  ref: z.string().optional().describe('Branch, tag, or commit ref'),
} as const;

// --- Search Tools --------------------------------------------------------

export const searchCodeShape = {
  project,
  query: z.string().min(1).max(500).describe('Search query'),
  limit,
  start,
} as const;

export const searchCommitsShape = {
  ...repoRefShape,
  query: z.string().min(1).max(500).describe('Search query'),
  limit,
  start,
} as const;
