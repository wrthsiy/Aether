import { useEffect, useRef, useState } from 'react';
import { useStore, useSettings, loadDoc, markLoaded, saveNow } from './store';
import { DEMO } from './demo';
import { b64decode } from './util';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import Preview from './components/Preview';
import ThemeStudio from './components/ThemeStudio';
import StatusBar from './components/StatusBar';

/** Pushes every setting into CSS variables / body classes → everything restyles instantly. */
function useApplyTheme() {
  const s = useSettings();
  useEffect(() => {
    const r = document.documentElement, b = document.body;
    const v: Record<string, string> = {
      '--bg-editor': s.bgEditor, '--bg-preview': s.bgPreview, '--text': s.text, '--accent': s.accent, '--accent-base': s.accent, '--code-bg': s.codeBg,
      '--font-editor': `'${s.editorFont}', ui-monospace, monospace`,
      '--font-preview': `'${s.previewFont}', ${s.previewFont === 'Inter' ? 'system-ui, sans-serif' : 'Georgia, serif'}`,
      '--fs': `${s.fontSize}px`, '--lh': String(s.lineHeight), '--col': `${s.colWidth}px`,
      '--lig': s.ligatures ? 'normal' : 'none', '--feat': s.ligatures ? '"liga" 1, "calt" 1' : '"liga" 0, "calt" 0',
      '--cursor-style': s.cursorStyle, '--cursor-blink': `${s.cursorBlinkSpeed}s`,
      '--active-line-style': s.activeLineStyle,
      '--focus-intensity': String(s.focusIntensity / 100),
      '--focus-dim': String(1 - 0.65 * (s.focusIntensity / 100)), // 0 → no dimming, 100 → opacity 0.35
      '--line-number-style': s.lineNumberStyle,
      '--editor-bg-effect': s.editorBgEffect, '--editor-bg-intensity': String(s.editorBgIntensity / 100),
      '--breathing-speed': `${s.breathingSpeed}s`, '--parallax-strength': `${s.parallaxStrength}px`,
      '--ambient-intensity': String(s.ambientIntensity / 100), '--hue-shift-speed': `${s.hueShiftSpeed}s`,
      '--frosted-edge-size': `${s.frostedEdgeSize}px`, '--crt-intensity': String(s.crtIntensity / 100),
    };
    Object.entries(v).forEach(([k, val]) => r.style.setProperty(k, val));
    // Optional colors: unset → CSS falls back to var(--accent) at the point of use (so hue-shift reaches them)
    const opt: Record<string, string> = {
      '--cursor-color': s.cursorColor, '--active-line-color': s.activeLineColor,
      '--line-number-color': s.lineNumberColor, '--trail-color': s.cursorTrailColor,
    };
    Object.entries(opt).forEach(([k, val]) => (val ? r.style.setProperty(k, val) : r.style.removeProperty(k)));
    r.classList.toggle('dark', s.dark);
    const flags: Record<string, boolean> = {
      breathing: s.breathingEnabled, ambient: s.ambientEnabled, 'hue-shift': s.hueShiftEnabled,
      'frosted-edge': s.frostedEdgeEnabled, paper: s.paperEnabled, crt: s.crtEnabled,
      'cursor-trail': s.cursorTrailEnabled, 'focus-mode': s.focusMode,
    };
    Object.entries(flags).forEach(([k, on]) => b.classList.toggle(k, on));
  }, [s]);

  // Parallax: rAF-throttled mouse position → --px/--py in [-1, 1]. Skipped on touch / reduced motion.
  useEffect(() => {
    if (!s.parallaxEnabled) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = document.documentElement; let raf = 0, x = 0, y = 0;
    document.body.classList.add('parallax');
    const mv = (e: MouseEvent) => {
      x = (e.clientX / innerWidth) * 2 - 1; y = (e.clientY / innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; r.style.setProperty('--px', x.toFixed(3)); r.style.setProperty('--py', y.toFixed(3)); });
    };
    window.addEventListener('mousemove', mv, { passive: true });
    return () => {
      window.removeEventListener('mousemove', mv); cancelAnimationFrame(raf);
      document.body.classList.remove('parallax'); r.style.removeProperty('--px'); r.style.removeProperty('--py');
    };
  }, [s.parallaxEnabled]);
  return s;
}

export default function App() {
  const s = useApplyTheme();
  const { mode, setMode, setContent } = useStore();
  const [ready, setReady] = useState(false);
  const [split, setSplit] = useState(50);
  const box = useRef<HTMLDivElement>(null);

  // Initial load priority: shared URL hash → IndexedDB → demo document
  useEffect(() => {
    (async () => {
      let c: string | undefined;
      const h = location.hash.match(/^#c=(.+)/);
      if (h) { try { c = b64decode(h[1]); } catch { /* bad link, ignore */ } }
      c ??= await loadDoc();
      c ??= DEMO;
      setContent(c); markLoaded(c); setReady(true);
    })();
  }, [setContent]);

  // Autosave every 2s (saveNow skips when nothing changed)
  useEffect(() => { const t = setInterval(() => saveNow(), 2000); return () => clearInterval(t); }, []);

  // Esc leaves Zen mode
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && useStore.getState().mode === 'zen') setMode('split'); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [setMode]);

  // Draggable divider (horizontal on desktop, vertical on mobile)
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const mobile = matchMedia('(max-width:768px)').matches;
    const mv = (ev: PointerEvent) => {
      const r = box.current!.getBoundingClientRect();
      const p = mobile ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
      setSplit(Math.min(80, Math.max(20, p * 100)));
    };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  };

  if (!ready) return null;
  const zen = mode === 'zen';
  const showEd = mode !== 'preview', showPv = mode === 'split' || mode === 'preview';

  return (
    <div className="pp flex h-full flex-col" style={{ background: 'var(--bg-editor)' }}>
      {!zen && <Toolbar />}
      <main ref={box} className="pp flex min-h-0 flex-1 flex-col md:flex-row">
        <section className={`pp min-h-0 min-w-0 ${zen ? 'zen' : ''}`}
          style={{ display: showEd ? undefined : 'none', flex: mode === 'split' ? `0 0 ${split}%` : '1 1 0' }}>
          <Editor />
        </section>
        {mode === 'split' && (
          <div onPointerDown={drag} role="separator" aria-label="Resize panes"
            className="no-print z-10 h-1.5 shrink-0 cursor-row-resize touch-none md:h-auto md:w-1.5 md:cursor-col-resize"
            style={{ background: 'color-mix(in srgb, var(--accent) 35%, transparent)' }} />
        )}
        {showPv && <section className="pp fade-in min-h-0 min-w-0 flex-1"><Preview /></section>}
      </main>
      {!zen && <StatusBar />}
      {zen && <div className="fixed bottom-3 right-4 text-xs" style={{ color: 'var(--muted)' }}>Esc to exit Zen</div>}
      {!zen && <ThemeStudio />}
    </div>
  );
}
