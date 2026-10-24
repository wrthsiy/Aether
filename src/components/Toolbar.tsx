import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Mode } from '../types';
import { b64encode, buildHtml, download } from '../util';
import { useBarSwipe, useIsPhone } from '../mobile';

const MODES: [Mode, string][] = [['focus', 'Focus'], ['split', 'Split'], ['preview', 'Preview'], ['zen', 'Zen']];
// no Split on phones: one pane at a time
const PHONE_MODES: [Mode, string][] = [['focus', 'Edit'], ['preview', 'Preview'], ['zen', 'Zen']];

export default function Toolbar() {
  const { mode, setMode, toggle, studioOpen, tocOpen, content, toggleDark, patch } = useStore();
  const settings = useStore((s) => s.settings);
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState('');
  const phone = useIsPhone(), sw = useBarSwipe();
  const menuRef = useRef<HTMLDivElement>(null);
  const flash = (m: string, ms = 2200) => { setMsg(m); setTimeout(() => setMsg(''), ms); };
  const compress = settings.exportCompress ?? true;

  // phone "more" menu: close on outside tap
  useEffect(() => {
    if (!menu || !phone) return;
    const f = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('pointerdown', f);
    return () => document.removeEventListener('pointerdown', f);
  }, [menu, phone]);

  const share = async () => {
    const url = `${location.origin}${location.pathname}#c=${b64encode(content)}`;
    await navigator.clipboard.writeText(url);
    flash(url.length > 100000 ? 'Link copied (very long – may not open everywhere)' : 'Link copied');
  };
  const exportHtml = async () => {
    setMenu(false); flash('Preparing export…', 15000);
    try {
      const r = await buildHtml(content, settings, { compress });
      download('aether.html', r.html, 'text/html');
      const mb = r.bytes / 1048576;
      if (r.bgFailed) flash('Exported, but the background image could not be embedded', 6000);
      else if (mb > 10) flash(`Exported ${mb.toFixed(1)} MB: large file${compress ? '' : ', try Compress images'}`, 6000);
      else flash(`Exported (${mb.toFixed(1)} MB)`);
    } catch { flash('Export failed', 4000); }
  };
  const pdf = () => {
    // The print stylesheet only shows the preview, so make sure it is mounted first
    const prev = mode; setMode('preview'); setMenu(false);
    setTimeout(() => { window.print(); setMode(prev); }, 300);
  };

  if (phone) {
    const cur: Mode = mode === 'split' ? 'focus' : mode;
    const item = (label: string, fn: () => void) => (
      <button key={label} className="btn" onClick={() => { fn(); setMenu(false); }}>{label}</button>
    );
    return (
      <header {...sw} className={`${sw.className} no-print glass bar-top relative z-20 flex shrink-0 items-center gap-2 px-3`}>
        <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--accent)' }}>Aether</h1>
        <div className="flex gap-1" role="tablist" aria-label="View mode">
          {PHONE_MODES.map(([m, l]) => (
            <button key={m} role="tab" aria-selected={cur === m} className={`btn ${cur === m ? 'on' : ''}`} onClick={() => setMode(m)}>{l}</button>
          ))}
        </div>
        <span className="truncate text-xs" style={{ color: 'var(--muted)' }}>{msg}</span>
        <div className="ml-auto flex gap-1">
          <button className={`btn ${studioOpen ? 'on' : ''}`} title="Theme Studio" aria-label="Theme Studio" onClick={() => toggle('studioOpen')}>⚙</button>
          <div className="relative" ref={menuRef}>
            <button className="btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋯</button>
            {menu && (
              <div className="more-menu glass fade-in">
                {item('Copy share link', share)}
                {item(tocOpen ? 'Hide contents' : 'Table of contents', () => toggle('tocOpen'))}
                {item(settings.dark ? 'Light theme' : 'Dark theme', toggleDark)}
                {item('Download .md', () => download('aether.md', content, 'text/markdown'))}
                {item('Download .html', exportHtml)}
                {item(`Compress images: ${compress ? 'on' : 'off'}`, () => patch({ exportCompress: !compress }))}
                {item('Print to PDF', pdf)}
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="no-print glass bar-top relative z-20 flex h-12 shrink-0 items-center gap-2 px-3">
      <h1 className="mr-2 text-lg font-bold tracking-tight" style={{ color: 'var(--accent)' }}>Aether</h1>
      <div className="flex gap-1" role="tablist" aria-label="View mode">
        {MODES.map(([m, l]) => (
          <button key={m} role="tab" aria-selected={mode === m} className={`btn ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>{l}</button>
        ))}
      </div>
      <span className="ml-2 truncate text-xs" style={{ color: 'var(--muted)' }}>{msg}</span>
      <div className="ml-auto flex gap-1">
        <button className={`btn ${tocOpen ? 'on' : ''}`} title="Table of contents" onClick={() => toggle('tocOpen')}>☰</button>
        <button className="btn" title="Light / dark" onClick={toggleDark}>{settings.dark ? '☀' : '🌙'}</button>
        <button className="btn" title="Copy share link" onClick={share}>🔗</button>
        <div className="relative">
          <button className="btn" title="Export" onClick={() => setMenu(!menu)}>💾</button>
          {menu && (
            <div className="glass fade-in absolute right-0 top-9 flex w-40 flex-col gap-1 rounded-xl p-2">
              <button className="btn" onClick={() => { download('aether.md', content, 'text/markdown'); setMenu(false); }}>Download .md</button>
              <button className="btn" onClick={exportHtml}>Download .html</button>
              <label className="flex items-center gap-2 px-1 text-xs"><input type="checkbox" checked={compress} style={{ accentColor: 'var(--accent)' }} onChange={(e) => patch({ exportCompress: e.target.checked })} />Compress images</label>
              <button className="btn" onClick={pdf}>Print to PDF</button>
            </div>
          )}
        </div>
        <button className={`btn ${studioOpen ? 'on' : ''}`} title="Theme Studio" onClick={() => toggle('studioOpen')}>⚙</button>
      </div>
    </header>
  );
}
