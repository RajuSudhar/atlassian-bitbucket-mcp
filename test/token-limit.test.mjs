import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toolHandler, buildTokenLimitGuidance } from '../dist/src/tools/registry.js';
import { countOutputTokens } from '../dist/src/tools/token-count.js';

describe('Unit: toolHandler', () => {
  it('should pass through under-limit results unchanged', async () => {
    const result = {
      content: [{ type: 'text', text: 'Small response' }],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 10000 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    assert.deepStrictEqual(wrapped_result, result);
  });

  it('should replace over-limit results with guidance error', async () => {
    const largeText = 'x'.repeat(50000); // Ensure this exceeds the limit
    const result = {
      content: [{ type: 'text', text: largeText }],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 100 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    assert.equal(wrapped_result.isError, true);
    assert.ok(Array.isArray(wrapped_result.content));
    assert.equal(wrapped_result.content[0].type, 'text');
    assert.ok(typeof wrapped_result.content[0].text === 'string');
    assert.ok(wrapped_result.content[0].text.length > 0);
  });

  it('should include tool name, count, and limit in guidance text', async () => {
    const largeText = 'x'.repeat(50000);
    const result = {
      content: [{ type: 'text', text: largeText }],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 100 },
      tools: {},
    };

    const wrapped = toolHandler('my_list_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    const guidance = wrapped_result.content[0].text;
    assert.ok(guidance.includes('my_list_tool'), 'should mention tool name');
    assert.ok(guidance.includes('100'), 'should mention limit');
    const actualCount = countOutputTokens(result);
    assert.ok(
      guidance.includes(String(actualCount)),
      'guidance should include the estimated token count'
    );
  });

  it('should include narrowing strategy in guidance', async () => {
    const largeText = 'x'.repeat(50000);
    const result = {
      content: [{ type: 'text', text: largeText }],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 100 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    const guidance = wrapped_result.content[0].text;
    assert.ok(
      guidance.includes('limit') && guidance.includes('Reduce'),
      'should mention narrowing by limit'
    );
  });

  it('should include both raise-limit paths in guidance', async () => {
    const largeText = 'x'.repeat(50000);
    const result = {
      content: [{ type: 'text', text: largeText }],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 100 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    const guidance = wrapped_result.content[0].text;
    assert.ok(
      guidance.includes('bitbucket-mcp.config.json'),
      'should mention per-tool config path'
    );
    assert.ok(guidance.includes('BITBUCKET_MCP_MAX_OUTPUT_TOKENS'), 'should mention env var');
  });

  it('should respect per-tool limit over default limit', async () => {
    const largeText = 'x'.repeat(50000);
    const result = {
      content: [{ type: 'text', text: largeText }],
    };
    const fn = async () => result;

    // First call with per-tool limit lower than default
    const governor1 = {
      defaults: { maxOutputTokens: 10000 },
      tools: { test_tool: { maxOutputTokens: 100 } },
    };

    const wrapped1 = toolHandler('test_tool', governor1, fn);
    const result1 = await wrapped1(undefined);
    assert.equal(result1.isError, true, 'should fail with per-tool low limit');

    // Second call with per-tool limit higher than default
    const governor2 = {
      defaults: { maxOutputTokens: 100 },
      tools: { test_tool: { maxOutputTokens: 100000 } },
    };

    const wrapped2 = toolHandler('test_tool', governor2, fn);
    const result2 = await wrapped2(undefined);
    assert.deepStrictEqual(result2, result);
  });

  it('should propagate errors thrown by fn unchanged', async () => {
    const error = new Error('Custom handler error');
    const fn = async () => {
      throw error;
    };
    const governor = {
      defaults: { maxOutputTokens: 10000 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);

    await assert.rejects(
      () => wrapped(undefined),
      (err) => err === error && err.message === 'Custom handler error'
    );
  });

  it('should pass through isError: true results unchanged without counting', async () => {
    let contentAccessCount = 0;
    const result = {
      get content() {
        contentAccessCount++;
        throw new Error('countOutputTokens was called on isError bypass path');
      },
      isError: true,
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 100 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    // Should return unchanged without accessing content, proving countOutputTokens was not called
    assert.equal(wrapped_result.isError, true);
    assert.equal(contentAccessCount, 0, 'content getter should not be accessed (countOutputTokens not called)');
  });

  it('should not perform cache operations regardless of limit outcome', async () => {
    let cacheInvalidateCount = 0;
    const cacheInvalidate = () => {
      cacheInvalidateCount++;
    };

    // Fake write-tool handler that calls cacheInvalidate once per invocation
    const writeToolFn = async (args) => {
      cacheInvalidate();
      const isLarge = args && args.size === 'large';
      if (isLarge) {
        return {
          content: [{ type: 'text', text: 'x'.repeat(50000) }],
        };
      } else {
        return {
          content: [{ type: 'text', text: 'small result' }],
        };
      }
    };

    // Set limit between small and large result sizes
    const governor = {
      defaults: { maxOutputTokens: 500 },
      tools: {},
    };

    const wrapped = toolHandler('bitbucket_test_write', governor, writeToolFn);

    // Call with small args — should pass through unchanged
    const smallArgs = { size: 'small' };
    const smallResult = await wrapped(smallArgs);
    assert.deepStrictEqual(smallResult, { content: [{ type: 'text', text: 'small result' }] });
    assert.equal(
      cacheInvalidateCount,
      1,
      'cache invalidate should be called once after small result'
    );

    // Call with large args — should be replaced with guidance error
    const largeArgs = { size: 'large' };
    const largeResult = await wrapped(largeArgs);
    assert.equal(largeResult.isError, true, 'large result should be an error');
    assert.equal(
      cacheInvalidateCount,
      2,
      'cache invalidate should be called again, even though result is over-limit'
    );

    // Assert final count is exactly 2
    assert.equal(cacheInvalidateCount, 2, 'wrapper should not perform any cache operations');
  });

  it('should call fn with the original args', async () => {
    let capturedArgs;
    const fn = async (args) => {
      capturedArgs = args;
      return { content: [{ type: 'text', text: 'result' }] };
    };

    const governor = {
      defaults: { maxOutputTokens: 10000 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const testArgs = { project: 'TEST', repo: 'my-repo', limit: 10 };

    await wrapped(testArgs);

    assert.deepStrictEqual(capturedArgs, testArgs);
  });

  it('should handle mixed content types in results', async () => {
    const result = {
      content: [
        { type: 'text', text: 'Some text' },
        { type: 'text', text: 'More text' },
      ],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 10000 },
      tools: {},
    };

    const wrapped = toolHandler('test_tool', governor, fn);
    const wrapped_result = await wrapped(undefined);

    assert.deepStrictEqual(wrapped_result, result);
  });

  it('should use correct tool name in guidance when different tools have different limits', async () => {
    const largeText = 'x'.repeat(50000);
    const result = {
      content: [{ type: 'text', text: largeText }],
    };
    const fn = async () => result;
    const governor = {
      defaults: { maxOutputTokens: 100 },
      tools: {},
    };

    // Test with one tool name
    const wrapped1 = toolHandler('first_tool_name', governor, fn);
    const result1 = await wrapped1(undefined);
    assert.ok(result1.content[0].text.includes('first_tool_name'));

    // Test with different tool name
    const wrapped2 = toolHandler('second_tool_name', governor, fn);
    const result2 = await wrapped2(undefined);
    assert.ok(result2.content[0].text.includes('second_tool_name'));
    assert.ok(!result2.content[0].text.includes('first_tool_name'));
  });
});

describe('Unit: buildTokenLimitGuidance', () => {
  it('should include tool name in output', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('my_tool'));
  });

  it('should include token count in output', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('50000'));
  });

  it('should include limit in output', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('25000'));
  });

  it('should mention limit argument strategy', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.toLowerCase().includes('limit'));
  });

  it('should mention project and repo filtering', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('project'));
    assert.ok(text.includes('repo'));
  });

  it('should mention single-item retrieval tools', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(
      text.includes('bitbucket_get_pull_request') || text.includes('bitbucket_get_repository')
    );
  });

  it('should include per-tool config path example', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('bitbucket-mcp.config.json'));
    assert.ok(text.includes('maxOutputTokens'));
  });

  it('should include env var path', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('BITBUCKET_MCP_MAX_OUTPUT_TOKENS'));
  });

  it('should use double quotes for tool name reference in config', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes('"my_tool"'));
  });

  it('should not mention per_page (truthfulness check)', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(!text.includes('per_page'));
  });

  it('should not mention fields parameter (truthfulness check)', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    // Note: 'fields' might appear in 'bitbucket_search_code' or other contexts,
    // so we check more specifically
    assert.ok(!text.includes('"fields"'));
    assert.ok(!text.includes("'fields'"));
  });

  it('should correctly escape apostrophe in callers context', () => {
    const text = buildTokenLimitGuidance('my_tool', 50000, 25000);
    assert.ok(text.includes("caller's"));
  });
});
