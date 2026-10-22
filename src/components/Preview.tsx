import { useEffect, useState } from 'react';
import { useStore, useSettings } from '../store';
import { md } from '../md';
import { gradientCss } from '../util';
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
  return (
    <div className="pp preview-wrap relative h-full overflow-hidden" style={{ background: 'var(--bg-preview)' }}>
      {/* .bg-stack gets the parallax transform (see index.css); layers inside keep their own filters */}
      <div className="bg-stack absolute inset-0">
        {s.gradient.enabled && <div className="bg-layer absolute inset-0" style={{ background: gradientCss(s.gradient) }} />}
        {s.bgImage && (
          <div className="bg-layer absolute" style={{
            inset: -s.blur * 2, backgroundImage: `url(${s.bgImage})`, backgroundPosition: 'center',
            backgroundSize: s.bgMode === 'tile' ? 'auto' : s.bgMode, backgroundRepeat: s.bgMode === 'tile' ? 'repeat' : 'no-repeat',
            filter: `blur(${s.blur}px) saturate(${s.saturate}%)`,
          }} />
        )}
        {decorated && <div className="bg-layer absolute inset-0" style={{ background: `rgba(0,0,0,${s.darken / 100})` }} />}
      </div>
      <div className="scroll-area pp absolute inset-0 overflow-auto p-0 md:p-4">
        <article className={`preview print-area ${decorated ? 'glass rounded-2xl' : ''}`} onClick={onClick}
          data-paper={s.paperEnabled ? s.paperType : undefined} data-crt={s.crtEnabled ? 'on' : undefined}
          dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {tocOpen && <TOC />}
    </div>
  );
}
