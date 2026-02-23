import { describe, it, expect } from 'vitest';
import { extractPlainText, hashContent } from '../text-extractor.js';

describe('extractPlainText', () => {
  it('removes ATX headings', () => {
    expect(extractPlainText('# Title\n## Sub')).toBe('Title\nSub');
  });

  it('removes bold and italic markers', () => {
    expect(extractPlainText('**bold** and *italic*')).toBe('bold and italic');
  });

  it('removes fenced code blocks', () => {
    const md = 'intro\n```ts\nconst x = 1;\n```\noutro';
    const result = extractPlainText(md);
    expect(result).not.toContain('```');
    expect(result).not.toContain('const x');
    expect(result).toContain('intro');
    expect(result).toContain('outro');
  });

  it('keeps link text and discards URL', () => {
    expect(extractPlainText('[click here](https://example.com)')).toBe('click here');
  });

  it('removes images entirely', () => {
    expect(extractPlainText('![alt text](https://example.com/img.png)')).toBe('');
  });
});

describe('hashContent', () => {
  it('returns a 64-char hex SHA-256 string', () => {
    const hash = hashContent('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('produces the same hash for the same input', () => {
    expect(hashContent('same')).toBe(hashContent('same'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });
});
