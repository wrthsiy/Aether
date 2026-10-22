import { useDeferredValue, useMemo } from 'react';
import { useStore } from '../store';
import { md } from '../md';

/** Table of contents from H1–H3; ids come from markdown-it-anchor so they match the rendered headings. */
export default function TOC() {
  const content = useDeferredValue(useStore((s) => s.content));
  const items = useMemo(
    () => md.parse(content, {}).flatMap((t, i, a) =>
      t.type === 'heading_open' && +t.tag[1] <= 3 ? [{ level: +t.tag[1], id: t.attrGet('id') ?? '', text: a[i + 1].content }] : []),
    [content]
  );
  return (
    <nav className="toc glass no-print" aria-label="Table of contents">
      <strong>Contents</strong>
      {items.length === 0 && <p style={{ color: 'var(--muted)' }}>Add a heading to see it here.</p>}
      {items.map((h, i) => (
        <button key={i} style={{ paddingLeft: (h.level - 1) * 12 }}
          onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {h.text}
        </button>
      ))}
    </nav>
  );
}
