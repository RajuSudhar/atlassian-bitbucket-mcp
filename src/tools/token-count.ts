/*
 * Output-token counter for the per-tool response-size governor.
 *
 * gpt-tokenizer's o200k_base encoding (used by GPT-4o) is not exactly
 * Claude's tokenizer — Claude tokens run ~15-20% higher on prose. A 1.2
 * multiplier keeps the guard conservative: if we say "under 25000", the
 * caller is under 25000 for real. See the tokenizer research notes in
 * plane-mcp's src/tools/token-count.ts (identical rationale).
 *
 * This project's McpToolResult carries no structuredContent field — every
 * tool result's payload is text content only. Count only text.
 */

import { encode } from 'gpt-tokenizer/model/gpt-4o';

import type { McpToolResult } from '@types';

export const TOKEN_COUNT_MULTIPLIER = 1.2;

export function countOutputTokens(result: McpToolResult): number {
  const textParts = result.content.filter((c) => c.type === 'text').map((c) => c.text);
  if (textParts.length === 0) {
    return 0;
  }
  const payload = textParts.join('\n');
  return Math.ceil(encode(payload).length * TOKEN_COUNT_MULTIPLIER);
}
