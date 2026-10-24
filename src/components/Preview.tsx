import { useEffect, useState, type CSSProperties } from 'react';
import { useStore, useSettings } from '../store';
import { md } from '../md';
import { bgVars, previewAttrs } from '../util';
import TOC from './TOC';

export default function Preview() {
  const { content, setContent, tocOpen } = useStore();
  const s = useSettings();
  const [html, setHtml] = useState('');

  // 150ms debounce so typing never blocks on rendering
  useEffect(() => { const t = setTimeout(() => setHtml(md.render(content)), 150); return () => clearTimeout(t); }, [content]);

  const onClick = (e: React.MouseEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    const btn = t.closest('.copy-btn');
    if (btn) {
      navigator.clipboard.writeText(btn.parentElement!.querySelector('code')!.innerText);
      btn.textContent = 'Copied!'; setTimeout(() => (btn.textContent = 'Copy'), 1200);
      return;
    }
    if (t instanceof HTMLInputElement && t.type === 'checkbox') {
      // Toggle the Nth task marker in the source. (Task-like text inside fenced code would skew the count – known limitation.)
      const i = [...e.currentTarget.querySelectorAll('input.task-list-item-checkbox')].indexOf(t);
      let n = -1;
      setContent(content.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)[ xX](\])/gm, (m, a, b) => (++n === i ? a + (t.checked ? 'x' : ' ') + b : m)));
    }
  };

  const decorated = s.gradient.enabled || !!s.bgImage;
  // Same structure + same preview.css rules as the exported HTML; background values arrive as CSS variables (see bgVars in util.ts)
  return (
    <div className="pp preview-wrap" style={bgVars(s, s.bgImage) as unknown as CSSProperties}>
      <div className="bg-stack">
        {s.gradient.enabled && <div className="bg-layer bg-gradient" />}
        {s.bgImage && <div className="bg-layer bg-image" />}
        {decorated && <div className="bg-layer bg-dark" />}
      </div>
      <div className="scroll-area pp">
        <article className={`preview print-area ${decorated ? 'glass' : ''}`} onClick={onClick}
          {...previewAttrs(s)} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {tocOpen && <TOC />}
    </div>
  );
}
