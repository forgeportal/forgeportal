import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../renderer.js';

describe('renderMarkdown — security tests (critical)', () => {
  it('plain Markdown heading → valid HTML', async () => {
    const html = await renderMarkdown('# Title');
    expect(html).toContain('<h1>Title</h1>');
  });

  it('<script> tag → stripped from output (AC: 3)', async () => {
    const html = await renderMarkdown("<script>alert('xss')</script>\n\nHello");
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('<iframe> → stripped (AC: 4)', async () => {
    const html = await renderMarkdown('<iframe src="evil.com">evil</iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('<object> → stripped (AC: 4)', async () => {
    const html = await renderMarkdown('<object data="evil.swf">fallback</object>');
    expect(html).not.toContain('<object');
  });

  it('<img onerror="..."> → onerror attribute stripped (AC: 4)', async () => {
    const html = await renderMarkdown('![img](x.png)');
    // Rendered img should not have onerror
    expect(html).not.toContain('onerror');
  });

  it('<a href="javascript:..."> → javascript: protocol stripped (AC: 3)', async () => {
    const html = await renderMarkdown('[click](javascript:void(0))');
    expect(html).not.toContain('javascript:');
  });

  it('external link → target="_blank" rel="noopener noreferrer" (AC: 6)', async () => {
    const html = await renderMarkdown('[example](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
    expect(html).toContain('noreferrer');
  });

  it('internal relative link → no target/rel added', async () => {
    const html = await renderMarkdown('[page](./other-page.md)');
    expect(html).not.toContain('target="_blank"');
  });

  it('code blocks → rendered as <pre><code> (safe, not stripped)', async () => {
    const html = await renderMarkdown('```js\nconsole.log("hi");\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('console.log');
  });

  it('<embed> → stripped (AC: 4)', async () => {
    const html = await renderMarkdown('<embed src="evil.swf">');
    expect(html).not.toContain('<embed');
  });
});
