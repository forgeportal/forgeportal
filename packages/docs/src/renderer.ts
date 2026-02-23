import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeStringify from 'rehype-stringify';

// Module-level singleton — created once for performance, safe for concurrent use
// (each processor.process() call creates its own internal context)
// Order matters: sanitize FIRST (removes dangerous content), THEN add external link attributes.
// rehypeExternalLinks runs after sanitize — safe because it only adds target/rel to http(s) links.
const processor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: false }) // raw HTML in Markdown is NOT passed through
  .use(rehypeSanitize, defaultSchema) // GitHub-compatible allowlist — blocks script/iframe/object/embed/on*
  .use(rehypeExternalLinks, {
    target: '_blank',
    rel: ['noopener', 'noreferrer'],
  })
  .use(rehypeStringify);

export async function renderMarkdown(content: string): Promise<string> {
  const result = await processor.process(content);
  return String(result);
}
