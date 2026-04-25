# Automated Testing Infrastructure for MCP Tools — Research Findings

**Date:** 2026-04-15  
**Scope:** Node.js/TypeScript ecosystem, MCP protocol patterns, testing frameworks, and schema-driven approaches

---

## 1. MCP Testing Patterns (2025-2026)

### 1.1 Official Testing Utilities from @modelcontextprotocol/sdk

The official TypeScript SDK does not include built-in testing utilities, but provides the foundation for programmatic testing:

- **Core Testing Approach:** Tests are written using standard frameworks (Jest, Vitest, Mocha) that interact with MCP servers directly in-process via `stdio` transport or through `ChannelTransport` in testing contexts
- **No Mocking Required:** Unlike traditional API testing, MCP servers can be instantiated and tested directly in Node.js without subprocess overhead
- **Transport Layer:** The SDK provides `StdioServerTransport` which can be used for both production and testing scenarios

**Key Resources:**

- `@modelcontextprotocol/sdk` npm package provides the Server class and tool registration APIs
- Latest version: ^1.18.1 (may vary)
- Official SDK repository: <https://github.com/modelcontextprotocol/typescript-sdk>

### 1.2 MCP Inspector Tool

The **MCP Inspector** is an interactive, browser-based visual testing tool for MCP servers (equivalent to Postman for MCP).

**How It Works:**

- Architecture consists of two components:
  - **MCP Inspector Client (MCPI):** React-based web UI providing interactive testing interface
  - **MCP Proxy (MCPP):** Node.js server bridging the UI to MCP servers via stdio, SSE, or streamable-http transports

**Key Features:**

- **Tools Panel:** Lists all exposed tools, displays schemas, allows form-based input testing with custom parameters, shows JSON responses
- **Resources Panel:** Browse static context (files, schemas, data blobs) provided by server
- **Prompts Panel:** Display prompt templates, test with custom arguments, preview generated messages
- **Notifications Pane:** Real-time logs and server notifications

**Installation & Usage:**

```bash
npx @modelcontextprotocol/inspector <command> <args>

# Examples:
npx -y @modelcontextprotocol/inspector npx @modelcontextprotocol/server-filesystem /path/to/dir
npx @modelcontextprotocol/inspector node path/to/server/index.js args...
```

**Best Practices Workflow:**

1. Start Development: Launch Inspector with server, verify connectivity, check capability negotiation
2. Iterative Testing: Make server changes, rebuild, reconnect Inspector, test affected features
3. Test Edge Cases: Invalid inputs, missing arguments, concurrent operations, error handling

**Official Documentation:** <https://modelcontextprotocol.io/docs/tools/inspector>

### 1.3 Community Testing Frameworks for MCP

**FastMCP Testing Framework** (Python-based, but has TypeScript equivalents):

- Provides in-memory Client wrapping around Server instances
- Uses Pytest fixtures for test setup and teardown
- Eliminates network latency for deterministic testing
- Supports parametrized testing with pytest.mark.parametrize
- Integrates with inline-snapshot for complex data assertions

**Comprehensive Testing Framework** (haakco/mcp-testing-framework):

- Repository: <https://github.com/haakco/mcp-testing-framework>
- Features: Automated test generation, advanced mocking, coverage analysis,
  performance benchmarking, integration testing, custom matchers, multiple
  reporters
- Supports cross-server testing and compatibility validation

**MCP Test Runner** (privsim/mcp-test-runner):

- Unified interface for executing multiple testing frameworks (Pytest, Jest, Go,
  Rust, Flutter, Bats)
- Security features for command validation and sanitization
- Single entry point for heterogeneous test suites

### 1.4 Best Practices for Unit Testing MCP Tool Handlers

**Testing Pattern with FastMCP Client:**

```python
@pytest.fixture
async def mcp_client():
    async with Client(transport=mcp_server) as client:
        yield client

async def test_tool_execution(mcp_client):
    result = await mcp_client.call_tool("tool_name", {"param": "value"})
    assert result.success
    assert "expected" in result.content[0].text
```

**Key Principles:**

- **In-Memory Testing:** Run server and client in same process for speed and reliability
- **Mock External Dependencies:** Isolate business logic from databases, APIs, file systems
- **Test Full Protocol Layer:** Don't mock the MCP protocol itself; test the actual interaction
- **Error Case Testing:** Validate both success and error responses (set `isError: true` for recoverable errors)
- **Deterministic Fixtures:** Use pytest fixtures with parametrization to test multiple input combinations

**Language-Specific Frameworks:**

- JavaScript/TypeScript: Jest, Vitest, Mocha
- Python: pytest with pytest-asyncio
- .NET: xunit with skUnit

**CI/CD Optimization:**

- Use in-memory testing in CI pipelines (no subprocess overhead)
- FastMCP Client is ideal for rapid feedback in automated testing
- Avoid transport-layer flakiness by testing at the logic layer

---

## 2. YAML/TOML-Driven Test Case Generation

### 2.1 Existing Frameworks for Declarative Test Definitions

**Tavern** (RESTful API Testing):

- Repository: <https://github.com/taverntesting/tavern>
- Format: YAML-based, human-readable test definitions
- Capabilities: Simple to complex test scenarios, data-driven testing via pytest parametrize
- Scope: RESTful APIs, MQTT APIs, gRPC services
- Test structure: Request definition → expected response validation → optional variable capture
- Excellent for: Contract testing, integration testing of HTTP services

**pytest-bdd:**

- Repository: <https://github.com/cucumber/pytest-bdd-ng>
- Format: Gherkin language (natural language BDD syntax)
- Advantage: Integrates with pytest ecosystem without requiring separate test runner
- Use case: Behavior-driven development, stakeholder-readable test specifications

**StructBDD DSL:**

- Supports YAML, TOML, JSON5, HJSON natively
- Extension for pytest-bdd enabling multiple DSL formats
- Flexible fixture systems
- Schema validation on test structure

**Cucumber/Gherkin:**

- Industry standard for BDD
- Natural language test definitions
- Step-based testing model
- Extensive tool support across languages

### 2.2 Schema-Driven Testing Approaches

**Declarative Testing Pattern:**

- Define test cases as data (YAML/TOML files)
- Single schema validates all test structure
- Fixtures provide reusable setup/teardown logic
- Parametrization generates multiple test cases from single definition

**Test Fixture Systems:**

- **Purpose:** Predefined sets of input data and expected results
- **Benefits:** Eliminates boilerplate, improves test maintainability, enables test reuse
- **Implementation:** Declarative fixtures capture setup once, apply to many tests
- **AutoFixture Pattern (.NET):** Minimizes Arrange phase, automatically generates test data matching constraints

**Spec-Driven Development:**

- Specification becomes executable and authoritative
- Tools generate type models, contract stubs, validation middleware from schema
- Outputs include: Types, validators, documentation, integration/conformance tests
- Enables shift-left testing: Downstream teams mock server before it's built

### 2.3 YAML vs TOML for Test Definitions

**YAML Advantages:**

- More readable for humans due to whitespace-based structure
- Lower cognitive load for test writers
- Excellent for: Tavern (established ecosystem), BDD approaches
- Better for: Simple hierarchies, list-heavy test definitions

**TOML Advantages:**

- Stricter syntax, less ambiguity
- Better IDE support and validation
- Excellent for: Configuration-heavy test definitions
- Better for: Complex nested objects, type clarity
- Example: Hurl `.hurl` format (TOML-like DSL for HTTP testing)

**Recommendation:** Use YAML for test case definitions (readability), TOML for configuration (explicitness)

---

## 3. Tool Registry / SSOT Patterns

### 3.1 Official MCP Registry

**MCP Registry Architecture:**

- Repository: <https://github.com/modelcontextprotocol/registry>
- Public API: <https://registry.modelcontextprotocol.io/>
- Purpose: Community-driven catalog of publicly available MCP servers
- Metadata stored: Endpoint, capabilities, versioning, input-output schemas, authentication

**Registry as SSOT:**

- Maintains structured metadata about server capabilities
- Enforces minimal validation: namespace uniqueness, schema conformance
- Intentionally extensible: Allows tags, categorization, curation data via
  subregistries
- OpenAPI-compatible: Registry itself published as OpenAPI spec for subregistry
  implementation

### 3.2 Tool Definition Schema (JSON Schema Standard)

Every MCP tool requires three components:

```json
{
  "name": "tool_identifier",
  "description": "What the tool does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "parameter_name": {
        "type": "string",
        "description": "Parameter description"
      }
    },
    "required": ["parameter_name"]
  }
}
```

**Key Fields:**

- **name** (required): Unique programmatic identifier
- **description** (required): Functional description for LLM context
- **inputSchema** (required): JSON Schema object defining parameters
- **outputSchema** (optional): JSON Schema for response validation
- **annotations** (optional): Client hints (audience, priority, lastModified)

**Schema Best Practices:**

- Keep schemas flat (minimize nesting) to reduce token count and cognitive load for LLMs
- Use primitive types (string, integer, boolean) over complex objects
- Break complex functionality into multiple simpler tools
- Use JSON Schema draft standard with proper type/properties definitions

**Example from MCP Spec:**

```json
{
  "name": "send_email",
  "description": "Sends an email to a specified address",
  "inputSchema": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string", "description": "Email address" },
      "subject": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["recipient", "subject", "body"]
  }
}
```

### 3.3 Code Generation from Schema Definitions

**OpenAPI TypeScript Code Generation Tools:**

**openapi-typescript:**

- Generates TypeScript types from OpenAPI 3.0/3.1 schemas
- Command: `npx openapi-typescript input.yaml --output types.ts`
- Zero dependencies (no Java/node-gyp)
- Fast local generation

**openapi-typescript-codegen:**

- Generates full TypeScript clients from OpenAPI spec
- Supports: Fetch, Node-Fetch, Axios, Angular, XHR clients
- Generates operation methods, request/response types
- Works with OpenAPI v2.0 and v3.0

**openapi-codegen:**

- Code generation from OpenAPI schema
- Generates TypeScript types and can generate React Query components
- Framework-agnostic approach

**Bidirectional Tools:**

- `ts-oas`: Generate OpenAPI specs from TypeScript types (code-first)
- `zod-to-json-schema`: Generate JSON Schema from Zod definitions
- `json-schema-to-zod`: Generate Zod schemas from JSON Schema

### 3.4 SSOT Pattern Implementation

**Schema-First Approach:**

- API contract defined before code
- Specification is source of truth
- Downstream teams can mock server behavior immediately
- "Shift-left testing": Catch issues before implementation

**SSOT Outputs from Single Schema:**

1. **Type Models:** TypeScript interfaces/types via openapi-typescript
2. **Validators:** Runtime validation via Zod or JSON Schema validators
3. **API Documentation:** Auto-generated docs from schema metadata
4. **Integration Tests:** Conformance tests generated from spec
5. **Mock Servers:** Test servers generated from schema

**Recommended Flow:**

```text
Schema Definition (YAML/JSON)
    ↓
Code Generation Tools
    ├→ TypeScript Types (openapi-typescript)
    ├→ Validators (Zod, JSON Schema)
    ├→ API Documentation (Swagger UI, ReDoc)
    ├→ Mock Servers
    └→ Conformance Tests
```

---

## 4. Output Schema Validation

### 4.1 Zod Schema Validation Patterns for Node.js

**Zod Overview:**

- TypeScript-first schema validation library
- Zero external dependencies
- 2kb core bundle (gzipped)
- Works in Node.js and all modern browsers
- Static type inference from schemas

**Basic Usage Pattern:**

```typescript
import { z } from 'zod';

// Define schema
const ToolResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    timestamp: z.number(),
  }),
  error: z.string().optional(),
});

// Type inference
type ToolResponse = z.infer<typeof ToolResponseSchema>;

// Validation
const result = ToolResponseSchema.parse(data); // Throws on error
const safe = ToolResponseSchema.safeParse(data); // Returns {success, data|error}
```

**Advanced Features:**

- Custom validation with `.refine()` and `.superRefine()`
- Type-safe error handling with ZodError
- Discriminated unions for variant handling
- Async validation for database/API checks
- Coercion and transformation with `.transform()`

### 4.2 JSON Schema Validation Libraries

**AJV (Another JSON Schema Validator):**

- High-performance JSON Schema validator
- TypeScript support via type inference
- Supports JSON Schema draft 7, 2019-09, 2020-12
- Fast compilation to JavaScript functions
- Works in Node.js and browsers

**TypeSchema (Universal Adapter):**

- Unified interface for multiple schema validation libraries
- Supports Zod, Yup, Ajv, TypeBox, Valibot
- Enables schema library agnostic code
- Standard Schema interface (emerging standard)

**Conversion Tools:**

- `zod-to-json-schema`: Convert Zod → JSON Schema (for interoperability)
- `json-schema-to-zod`: Convert JSON Schema → Zod (for TypeScript-first
  projects)
- Bidirectional conversion enables schema library switching

### 4.3 MCP Tool Output Validation Strategy

**Pattern for CallToolResult Validation:**

```typescript
// Define MCP tool output schema
const WeatherResponseSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  unit: z.enum(['celsius', 'fahrenheit']),
  conditions: z.string(),
  timestamp: z.string().datetime(),
});

// In tool handler
server.registerTool(
  'get_weather',
  {
    description: 'Get weather for location',
    inputSchema: z.object({ location: z.string() }),
    outputSchema: WeatherResponseSchema, // Document expected output
  },
  async ({ location }) => {
    const data = await fetchWeather(location);

    // Validate before returning
    const validated = WeatherResponseSchema.parse(data);

    return {
      content: [{ type: 'text', text: JSON.stringify(validated) }],
      structuredContent: validated,
    };
  }
);
```

### 4.4 Snapshot Testing vs Schema Testing Tradeoffs

**Snapshot Testing:**

- **Approach:** Store literal output, compare future runs byte-for-byte
- **Strengths:** Simple implementation, catches any changes
- **Weaknesses:** Fails on every dynamic data change, high maintenance burden
- **Use Case:** DOM snapshots (React components with static structure)

**Schema Testing (Recommended for APIs):**

- **Approach:** Validate output structure against JSON Schema
- **Strengths:**
  - Tolerates dynamic data (timestamps, IDs)
  - Catches structural changes
  - Documents expected format
  - Works with frequently changing data
- **Weaknesses:** Requires schema maintenance, may miss value-level issues
- **Use Case:** API responses, MCP tool outputs

**Hybrid Approach:**

```typescript
// Use schema testing for structure, property-based testing for values
test('weather tool response', async () => {
  const result = await callTool('get_weather', { location: 'NYC' });

  // Schema validation
  const validated = WeatherResponseSchema.parse(result);

  // Value assertions
  expect(validated.temperature).toBeGreaterThan(-50);
  expect(validated.temperature).toBeLessThan(50);
  expect(validated.location).toBe('NYC');
});
```

**Recommendation:** Use schema testing as primary validation for MCP tool outputs, reserve snapshots for truly static data only.

---

## 5. SDK Design Patterns for Declarative Tool Definitions

### 5.1 Stripe SDK & AWS SDK Patterns

**Stripe SDK TypeScript Pattern:**

- Explicit types for operation parameters: `Stripe.CustomerCreateParams`
- Explicit types for responses: `Stripe.Customer`
- Types reflect latest API version
- Type definitions are self-documenting
- Strongly typed configuration objects

**AWS SDK v3 JavaScript/TypeScript Pattern:**

- Middleware stack architecture for customization
- Type-first approach with self-documenting definitions
- Serialization/deserialization middleware functions
- Customizable async middleware for auth, logging, retry logic
- Built-in TypeScript support (native, not typings)

**Common Pattern:** Both use explicit typed operation definitions rather than generic request/response builders.

### 5.2 Config-Driven SDK Patterns

**Single Source of Truth Implementation:**

- Schema (OpenAPI, JSON Schema) is authoritative definition
- Code generation creates all derived artifacts
- Type mismatches fail at compile-time, not runtime
- Schema changes propagate to all consumers automatically

**Config-First SDK Generation:**

```text
API Specification (OpenAPI/JSON Schema)
    ↓
Code Generation (openapi-typescript, Stainless)
    ├→ TypeScript Operation Types
    ├→ Request/Response Interfaces
    ├→ API Client Methods
    └→ Documentation
```

**Benefits:**

- Eliminates drift between spec and implementation
- Enables contract-first development
- Downstream teams can start work immediately with mocked servers
- Documentation auto-generated and always current

### 5.3 TypeScript SDK Design for Code Generation

**Recommended Approach:**

1. Define tool specifications in declarative format (JSON/YAML)
2. Use code generation tools (openapi-typescript, custom generators)
3. Generate:
   - TypeScript types/interfaces
   - Zod validators
   - Documentation markdown
   - Test fixtures
   - Mock implementations

**Example Generated Type:**

```typescript
// From schema definition
export interface GetWeatherParams {
  location: string;
  unit?: 'celsius' | 'fahrenheit';
}

export interface GetWeatherResponse {
  location: string;
  temperature: number;
  unit: 'celsius' | 'fahrenheit';
  conditions: string;
  timestamp: string;
}
```

**Generated Validator:**

```typescript
export const GetWeatherParamsSchema = z.object({
  location: z.string(),
  unit: z.enum(['celsius', 'fahrenheit']).optional(),
});

export const GetWeatherResponseSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  unit: z.enum(['celsius', 'fahrenheit']),
  conditions: z.string(),
  timestamp: z.string().datetime(),
});
```

---

## 6. MCP SDK Specifics

### 6.1 @modelcontextprotocol/sdk Overview

**Latest Version:** ^1.18.1 (as of April 2026)

**Installation:**

```bash
npm install @modelcontextprotocol/sdk
```

**Core Exports:**

- `Server`: Main server class
- `StdioServerTransport`: stdio-based transport
- `SSEServerTransport`: Server-sent events transport
- `CallToolResult`: Tool execution result type
- `TextContent`, `ImageContent`: Content types
- `Tool`: Tool interface/definition

### 6.2 Tool Definition in TypeScript SDK

**Tool Registration API (registerTool method):**

```typescript
server.registerTool(
  name: string,
  {
    description: string,
    inputSchema: ZodSchema,
    outputSchema?: ZodSchema,
    annotations?: ToolAnnotations
  },
  handler: async (args: z.infer<InputSchema>) => CallToolResult
)
```

**Complete Example:**

```typescript
import { Server } from '@modelcontextprotocol/sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk';
import { z } from 'zod';

const server = new Server({
  name: 'math-server',
  version: '1.0.0',
});

const transport = new StdioServerTransport();

// Register a tool
server.registerTool(
  'add',
  {
    description: 'Add two numbers',
    inputSchema: z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
  },
  async ({ a, b }) => {
    const result = a + b;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ result }),
        },
      ],
      structuredContent: { result },
    };
  }
);

server.connect(transport);
```

### 6.3 MCP Protocol Schema for Tools

**Tool Definition Structure (from MCP specification):**

```typescript
interface Tool {
  // Unique identifier for the tool
  name: string;

  // Human-readable description
  description: string;

  // JSON Schema defining parameters (usually object type)
  inputSchema: JSONSchema;

  // Optional: JSON Schema for response validation
  outputSchema?: JSONSchema;

  // Optional: Client hints (audience, priority, lastModified)
  annotations?: {
    audience?: string[];
    priority?: number;
    lastModified?: string;
  };
}
```

**inputSchema Requirements:**

- Must be JSON Schema compatible
- Top level almost always `type: "object"`
- Each property is a tool parameter
- Required array specifies mandatory parameters
- Each parameter should include description for LLM context

### 6.4 Programmatic Testing of MCP Tools

**In-Memory Testing Pattern (Recommended):**

```typescript
import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk';
import { z } from 'zod';

describe('MCP Tools', () => {
  let server: Server;

  beforeEach(() => {
    server = new Server({ name: 'test-server', version: '1.0.0' });

    // Register test tool
    server.registerTool(
      'test_tool',
      {
        description: 'Test tool',
        inputSchema: z.object({ input: z.string() }),
      },
      async ({ input }) => ({
        content: [{ type: 'text', text: `echo: ${input}` }],
      })
    );
  });

  it('tool executes successfully', async () => {
    // Simulate tool call
    const result = await server.callTool('test_tool', { input: 'hello' });

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('hello');
  });

  it('validates input against schema', async () => {
    // Invalid input should fail
    expect(() => server.callTool('test_tool', { input: 123 })).toThrow();
  });
});
```

**Testing with Transport Simulation:**

```typescript
// Direct tool handler testing (unit level)
import { z } from 'zod';

const toolHandler = async ({ location }: { location: string }) => {
  const data = await getWeather(location);
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  };
};

// Test handler directly
it('handler processes location', async () => {
  const result = await toolHandler({ location: 'NYC' });
  expect(result.structuredContent.location).toBe('NYC');
});
```

**Error Handling Pattern:**

```typescript
server.registerTool(
  'fetch_data',
  {
    description: 'Fetch external data',
    inputSchema: z.object({ id: z.string() }),
  },
  async ({ id }) => {
    try {
      const data = await externalAPI.fetch(id);
      return {
        content: [{ type: 'text', text: JSON.stringify(data) }],
      };
    } catch (error) {
      // Errors visible to LLM for self-correction
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true, // Signals error to client
      };
    }
  }
);
```

---

## 7. Recommended Architecture for Automated Testing Infrastructure

### 7.1 Layered Testing Approach

```text
Layer 1: Unit Tests (Tools in Isolation)
├─ Tool handler functions tested directly
├─ Input schema validation via Zod
├─ Output schema validation via Zod
└─ Mocked external dependencies

Layer 2: Integration Tests (Tools via MCP Protocol)
├─ Server instance with real tool registration
├─ Simulated client requests
├─ Protocol-level behavior validation
└─ Multi-tool interaction testing

Layer 3: System Tests (Server + Transport)
├─ Full server with stdio/SSE/HTTP transport
├─ Real client connection simulation
├─ End-to-end workflow validation
└─ MCP Inspector manual testing

Layer 4: Conformance Tests
├─ MCP specification compliance
├─ Tool schema compliance
├─ Protocol message format validation
└─ Error handling standards
```

### 7.2 YAML-Driven Test Case Format for MCP

**Proposed Schema-Driven Test Format:**

```yaml
tools:
  - name: add
    description: Addition function
    tests:
      - name: simple_addition
        input:
          a: 5
          b: 3
        expectedOutput:
          result: 8
        expectedStatus: success

      - name: negative_numbers
        input:
          a: -5
          b: 3
        expectedOutput:
          result: -2
        expectedStatus: success

      - name: invalid_input_type
        input:
          a: 'five'
          b: 3
        expectedStatus: error
        expectedErrorPattern: 'invalid.*number'

resources:
  - name: config
    description: Server configuration resource
    tests:
      - name: fetch_config
        expectedContentType: 'application/json'
        expectedStructure:
          maxConnections: number
          timeout: number
```

### 7.3 Implementation Recommendations

**For Node.js/TypeScript MCP Infrastructure:**

1. **Test Definition Language:** YAML (readability) + Zod schemas (validation)
2. **Test Execution:** Vitest or Jest with Pytest-style fixtures
3. **Schema Validation:** Zod for TypeScript-first validation
4. **Test Generation:** Custom code generation from tool registry
5. **CI/CD Integration:** In-memory FastMCP Client for speed
6. **Output Validation:** Schema validation (not snapshots) for dynamic data
7. **Tool Registry:** Centralized SSOT for all tool definitions with code generation
8. **Documentation:** Auto-generated from tool schemas

**Tooling Stack:**

- Schema Definition: JSON/YAML (tool registry format)
- Code Generation: openapi-typescript or custom generators
- Runtime Validation: Zod + JSON Schema validators
- Testing Framework: Vitest + custom YAML test runner
- Inspector: MCP Inspector for manual QA
- CI/CD: In-memory server testing via fastmcp-client pattern

---

## 8. References

### Official MCP Documentation

- [MCP Registry Architecture](https://workos.com/blog/mcp-registry-architecture-technical-overview)
- [MCP Registry Repository](https://github.com/modelcontextprotocol/registry)
- [MCP Inspector Documentation](https://modelcontextprotocol.io/docs/tools/inspector)
- [MCP Schema Reference](https://modelcontextprotocol.io/specification/2025-06-18/schema)
- [Official MCP Blog](https://blog.modelcontextprotocol.io/)

### SDK & Framework Documentation

- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [TypeScript SDK Repository](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python SDK Repository](https://github.com/modelcontextprotocol/python-sdk)
- [FastMCP Testing](https://gofastmcp.com/servers/testing)

### Testing Frameworks

- [Tavern API Testing](https://taverntesting.github.io/)
- [pytest-bdd Repository](https://github.com/cucumber/pytest-bdd-ng)
- [Hurl API Testing](https://hurl.dev/)

### Schema & Code Generation

- [openapi-typescript](https://github.com/openapi-ts/openapi-typescript)
- [Zod Schema Library](https://zod.dev/)
- [TypeSchema Universal Adapter](https://typeschema.com/)
- [AJV JSON Schema Validator](https://ajv.js.org/)

### Testing Patterns & Best Practices

- [Stop Vibe-Testing Your MCP Server](https://www.jlowin.dev/blog/stop-vibe-testing-mcp-servers)
- [Unit Testing MCP Servers Guide](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
- [How to Test MCP Server (2026 Guide)](https://testomat.io/blog/mcp-server-testing-tools/)
- [MCP Testing Framework (haakco)](https://github.com/haakco/mcp-testing-framework)

### Related Concepts

- [Schema-Shot: Snapshot Testing for Dynamic Data](https://github.com/bahmutov/schema-shot)
- [Single Source of Truth Patterns](https://strapi.io/blog/what-is-single-source-of-truth)
- [Schema-Driven Development](https://godspeed.hashnode.dev/schema-driven-development-and-single-source-of-truth)
- [Spec-Driven Development](https://www.infoq.com/articles/spec-driven-development/)

---

## 9. Key Takeaways for Bitbucket MCP Infrastructure

1. **Testing Pattern:** Use in-memory server testing with Zod-validated inputs/outputs, not snapshots
2. **Schema Registry:** Define all tools in a central YAML/JSON registry as SSOT
3. **Code Generation:** Generate TypeScript types, validators, and docs from schema definitions
4. **Test Format:** YAML-driven test cases validated against schemas
5. **CI/CD:** FastMCP Client pattern for deterministic, subprocess-free testing
6. **Tool Definition:** Use MCP TypeScript SDK's registerTool() with Zod for validation
7. **Conformance:** Validate against MCP protocol schema and tool input/output schemas
8. **Manual Testing:** MCP Inspector for interactive debugging and validation
9. **Documentation:** Auto-generate from tool schemas (descriptions, inputSchema, outputSchema)
10. **Transport:** Use stdio for testing, HTTP/SSE for production deployments

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-15  
**Author:** Research Agent (Web-based investigation)  
**Classification:** Internal Research Findings
