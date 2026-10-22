import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import tasks from 'markdown-it-task-lists';
import { full as emoji } from 'markdown-it-emoji';
import anchor from 'markdown-it-anchor';
import hljs from 'highlight.js/lib/common';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Returning a string that starts with <pre makes markdown-it use it verbatim,
// which lets us inject the per-block "Copy" button.
export const md: MarkdownIt = new MarkdownIt({
  html: false, linkify: true, typographer: true,
  highlight(code, lang) {
    const body = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : esc(code);
    return `<pre class="hljs"><button class="copy-btn" type="button">Copy</button><code>${body}</code></pre>`;
  },
})
  .use(footnote)
  .use(tasks, { enabled: true })
  .use(emoji)
  .use(anchor, { level: [1, 2, 3] });
