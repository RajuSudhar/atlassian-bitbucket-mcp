/*
 * MCP protocol types
 */

export type McpToolDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
};

export type McpToolResult = {
  readonly content: ReadonlyArray<McpTextContent | McpErrorContent>;
  readonly isError?: boolean;
};

export type McpTextContent = {
  readonly type: 'text';
  readonly text: string;
};

export type McpErrorContent = {
  readonly type: 'text';
  readonly text: string;
};

export type McpError = {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
};
