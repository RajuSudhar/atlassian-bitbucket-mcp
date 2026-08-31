import { strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { encode } from 'gpt-tokenizer/model/gpt-4o';

import { countOutputTokens, TOKEN_COUNT_MULTIPLIER } from '../dist/src/tools/token-count.js';

describe('Unit: countOutputTokens', () => {
  it('should return 0 for empty content array', () => {
    const result = { content: [] };
    strictEqual(countOutputTokens(result), 0);
  });

  it('should return 0 for a text item with empty string text', () => {
    const result = { content: [{ type: 'text', text: '' }] };
    strictEqual(countOutputTokens(result), 0);
  });

  it('should count single text content item with multiplier applied', () => {
    const text = 'Hello, world!';
    const result = { content: [{ type: 'text', text }] };
    const rawCount = encode(text).length;
    const expected = Math.ceil(rawCount * TOKEN_COUNT_MULTIPLIER);
    strictEqual(countOutputTokens(result), expected);
  });

  it('should join multiple text parts with newline before encoding', () => {
    const part1 = 'First part';
    const part2 = 'Second part';
    const result = {
      content: [
        { type: 'text', text: part1 },
        { type: 'text', text: part2 },
      ],
    };
    const joined = `${part1}\n${part2}`;
    const rawCount = encode(joined).length;
    const expected = Math.ceil(rawCount * TOKEN_COUNT_MULTIPLIER);
    strictEqual(countOutputTokens(result), expected);
  });

  it('should have TOKEN_COUNT_MULTIPLIER equal to 1.2', () => {
    strictEqual(TOKEN_COUNT_MULTIPLIER, 1.2);
  });

  it('should apply Math.ceil to round up fractional results', () => {
    const text = 'x';
    const result = { content: [{ type: 'text', text }] };
    const rawCount = encode(text).length;
    const withMultiplier = rawCount * TOKEN_COUNT_MULTIPLIER;
    const expected = Math.ceil(withMultiplier);
    strictEqual(countOutputTokens(result), expected);
    // Verify that ceil was actually needed (i.e., withMultiplier is not already an integer)
    // by checking that the result is at least Math.floor(withMultiplier) + 1 if fractional
    if (withMultiplier % 1 !== 0) {
      strictEqual(countOutputTokens(result) > Math.floor(withMultiplier), true);
    }
  });
});
